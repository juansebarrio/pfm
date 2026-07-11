/**
 * Capturas de las 10 pantallas para docs/comparativa/ (checklist final).
 * Chrome headless vía CDP crudo (WebSocket nativo de Node, sin dependencias):
 * inyecta la sesión de Juanse, emula 390×844 y saca PNG por pantalla,
 * en claro y en oscuro donde corresponde.
 *
 * Uso: la app corriendo en :3000 y `pnpm tsx --env-file=.env.local scripts/capturas.ts`
 */
import { execFile } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PUERTO_CDP = 9223;
const BASE = "http://localhost:3000";
const SALIDA = path.join(process.cwd(), "docs/comparativa");

type Pantalla = {
  archivo: string;
  ruta: string;
  esquema: "light" | "dark";
  scrollY?: number;
  esperaExtra?: number;
};

async function obtenerCookieSesion(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const respuesta = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "juanse@sobres.local",
      password: "coghlan-juanse-2026",
    }),
  });
  if (!respuesta.ok) throw new Error(`login falló: ${respuesta.status}`);
  const sesion = await respuesta.text();
  const ref = new URL(url).hostname.split(".")[0];
  const valor = `base64-${Buffer.from(sesion).toString("base64url")}`;
  return `sb-${ref}-auth-token=${valor}`;
}

class CDP {
  private ws!: WebSocket;
  private id = 0;
  private pendientes = new Map<number, (r: unknown) => void>();

  async conectar(urlWs: string) {
    this.ws = new WebSocket(urlWs);
    await new Promise<void>((ok, mal) => {
      this.ws.addEventListener("open", () => ok());
      this.ws.addEventListener("error", () => mal(new Error("ws error")));
    });
    this.ws.addEventListener("message", (evento) => {
      const m = JSON.parse(String(evento.data));
      if (m.id && this.pendientes.has(m.id)) {
        this.pendientes.get(m.id)!(m.result ?? m.error);
        this.pendientes.delete(m.id);
      }
    });
  }

  enviar<T = unknown>(metodo: string, params: object = {}): Promise<T> {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method: metodo, params }));
    return new Promise((ok) => this.pendientes.set(id, (r) => ok(r as T)));
  }

  cerrar() {
    this.ws.close();
  }
}

const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

async function main() {
  mkdirSync(SALIDA, { recursive: true });

  const [cookie, visaId] = await Promise.all([
    obtenerCookieSesion(),
    (async () => {
      // id de la Visa para /tarjetas/[id], leyendo la API con la secret key
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const skey = process.env.SUPABASE_SECRET_KEY!;
      const r = await fetch(`${url}/rest/v1/tarjetas?red=eq.visa&select=id`, {
        headers: { apikey: skey },
      });
      const filas = (await r.json()) as Array<{ id: string }>;
      return filas[0]?.id ?? "";
    })(),
  ]);

  const pantallas: Pantalla[] = [
    { archivo: "01a-presupuesto", ruta: "/presupuesto", esquema: "light" },
    { archivo: "01b-presupuesto-scrolleada", ruta: "/presupuesto", esquema: "light", scrollY: 900 },
    { archivo: "01c-primer-uso", ruta: "/presupuesto?mes=2026-09-01", esquema: "light" },
    { archivo: "02-armado-del-mes", ruta: "/presupuesto/armar?mes=2026-08-01", esquema: "light" },
    { archivo: "03-alta-rapida", ruta: "/gasto/nuevo", esquema: "light" },
    { archivo: "04-resumen", ruta: "/resumen", esquema: "light" },
    { archivo: "05-movimientos", ruta: "/movimientos", esquema: "light" },
    { archivo: "06-tarjeta-ciclo", ruta: `/tarjetas/${visaId}`, esquema: "light" },
    { archivo: "07-cuotas-activas", ruta: "/cuotas", esquema: "light" },
    { archivo: "08-patrimonio", ruta: "/patrimonio", esquema: "light" },
    { archivo: "09-hogar", ruta: "/hogar", esquema: "light" },
    { archivo: "10-presupuesto-oscuro", ruta: "/presupuesto", esquema: "dark" },
  ];

  // Chrome headless con puerto CDP
  const chrome = execFile(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${PUERTO_CDP}`,
    "--no-first-run",
    "--user-data-dir=/tmp/sobres-capturas-perfil",
    "about:blank",
  ]);
  try {
    // esperar el endpoint CDP
    let version: { webSocketDebuggerUrl: string } | null = null;
    for (let i = 0; i < 40 && !version; i++) {
      await esperar(500);
      try {
        version = (await (await fetch(`http://127.0.0.1:${PUERTO_CDP}/json/version`)).json()) as {
          webSocketDebuggerUrl: string;
        };
      } catch {
        /* todavía no */
      }
    }
    if (!version) throw new Error("Chrome CDP no levantó");

    const navegador = new CDP();
    await navegador.conectar(version.webSocketDebuggerUrl);
    const { targetId } = await navegador.enviar<{ targetId: string }>("Target.createTarget", {
      url: "about:blank",
    });
    const { sessionId } = await navegador.enviar<{ sessionId: string }>("Target.attachToTarget", {
      targetId,
      flatten: true,
    });

    // con flatten, los comandos de la página van con sessionId
    const pagina = {
      enviar: <T = unknown>(metodo: string, params: object = {}): Promise<T> => {
        const id = Math.floor(Math.random() * 1_000_000) + 1000;
        return new Promise((ok) => {
          const ws = (navegador as unknown as { ws: WebSocket }).ws;
          const escuchar = (evento: MessageEvent) => {
            const m = JSON.parse(String(evento.data));
            if (m.id === id) {
              ws.removeEventListener("message", escuchar as never);
              ok((m.result ?? m.error) as T);
            }
          };
          ws.addEventListener("message", escuchar as never);
          ws.send(JSON.stringify({ id, method: metodo, params, sessionId }));
        });
      },
    };

    await pagina.enviar("Page.enable");
    const [nombreCookie, valorCookie] = cookie.split("=");
    await pagina.enviar("Network.setCookie", {
      name: nombreCookie,
      value: valorCookie,
      url: BASE,
    });
    await pagina.enviar("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });

    for (const p of pantallas) {
      await pagina.enviar("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-color-scheme", value: p.esquema }],
      });
      await pagina.enviar("Page.navigate", { url: `${BASE}${p.ruta}` });
      await esperar(2500 + (p.esperaExtra ?? 0));
      if (p.scrollY) {
        await pagina.enviar("Runtime.evaluate", {
          expression: `window.scrollTo(0, ${p.scrollY})`,
        });
        await esperar(600);
      }
      const { data } = await pagina.enviar<{ data: string }>("Page.captureScreenshot", {
        format: "png",
      });
      writeFileSync(path.join(SALIDA, `${p.archivo}.png`), Buffer.from(data, "base64"));
      console.log(`✓ ${p.archivo}.png`);
    }

    navegador.cerrar();
  } finally {
    chrome.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
