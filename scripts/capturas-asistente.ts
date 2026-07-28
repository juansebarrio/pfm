/**
 * Capturas del asistente para la página de presentación.
 *
 * Mismo mecanismo que scripts/capturas.ts (Chrome headless por CDP crudo, con
 * la sesión de Juanse inyectada como cookie), pero acá hay que ESPERAR: la
 * respuesta llega en streaming, así que en vez de un sleep fijo se espera a que
 * aparezcan los chips de repregunta — que la pantalla solo dibuja cuando
 * terminó de pensar.
 *
 * Uso: la app corriendo en :3000 y
 *   pnpm tsx --env-file=.env.local scripts/capturas-asistente.ts
 */
import { execFile } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PUERTO_CDP = 9224;
// Por defecto local: es donde el código siempre está fresco. Para las tomas
// finales, BASE_CAPTURAS=https://pfm-mu.vercel.app una vez deployado.
const BASE = process.env.BASE_CAPTURAS ?? "http://localhost:3000";
const SALIDA = path.join(process.cwd(), "docs/presentacion");

const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

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
  return `sb-${ref}-auth-token=base64-${Buffer.from(sesion).toString("base64url")}`;
}

class CDP {
  ws!: WebSocket;
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

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const cookie = await obtenerCookieSesion();

  const chrome = execFile(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${PUERTO_CDP}`,
    "--no-first-run",
    "--user-data-dir=/tmp/fdm-capturas-asistente",
    "about:blank",
  ]);

  try {
    let version: { webSocketDebuggerUrl: string } | null = null;
    for (let i = 0; i < 40 && !version; i++) {
      await esperar(500);
      try {
        version = (await (
          await fetch(`http://127.0.0.1:${PUERTO_CDP}/json/version`)
        ).json()) as { webSocketDebuggerUrl: string };
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
    const { sessionId } = await navegador.enviar<{ sessionId: string }>(
      "Target.attachToTarget",
      { targetId, flatten: true },
    );

    const pagina = {
      enviar: <T = unknown>(metodo: string, params: object = {}): Promise<T> => {
        const id = Math.floor(Math.random() * 1_000_000) + 1000;
        return new Promise((ok) => {
          const escuchar = (evento: MessageEvent) => {
            const m = JSON.parse(String(evento.data));
            if (m.id === id) {
              navegador.ws.removeEventListener("message", escuchar as never);
              ok((m.result ?? m.error) as T);
            }
          };
          navegador.ws.addEventListener("message", escuchar as never);
          navegador.ws.send(JSON.stringify({ id, method: metodo, params, sessionId }));
        });
      },
    };

    const evaluar = async <T>(expression: string): Promise<T> => {
      const r = await pagina.enviar<{ result: { value: T } }>("Runtime.evaluate", {
        expression,
        returnByValue: true,
      });
      return r.result?.value;
    };

    /** Espera a que la expresión dé true; falla ruidosamente si no pasa. */
    const esperarA = async (expresion: string, que: string, segundos = 90) => {
      for (let i = 0; i < segundos * 2; i++) {
        if (await evaluar<boolean>(expresion)) return;
        await esperar(500);
      }
      throw new Error(`nunca pasó: ${que}`);
    };

    // los chips de repregunta solo se dibujan cuando terminó de pensar
    const TERMINO =
      "[...document.querySelectorAll('button')].some(b => b.textContent.trim().startsWith('¿'))";

    const capturar = async (archivo: string) => {
      // el indicador de dev de Next vive en un custom element aparte: fuera
      await evaluar("document.querySelector('nextjs-portal')?.remove()");
      const { data } = await pagina.enviar<{ data: string }>("Page.captureScreenshot", {
        format: "png",
      });
      writeFileSync(path.join(SALIDA, `${archivo}.png`), Buffer.from(data, "base64"));
      console.log(`  ✓ ${archivo}.png`);
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
      deviceScaleFactor: 3,
      mobile: true,
    });

    // El tema NO va por prefers-color-scheme: el toggle escribe data-tema en el
    // <html> (ver app/globals.css). Se fuerza después de cada navegación.
    const ponerTema = (t: "claro" | "oscuro") =>
      evaluar(`document.documentElement.dataset.tema = '${t}'`);

    for (const esquema of ["claro", "oscuro"] as const) {
      console.log(`\n${esquema}:`);

      // 1. la lectura de apertura, sin que nadie haya escrito nada
      await pagina.enviar("Page.navigate", { url: `${BASE}/asistente` });
      await esperar(1500);
      await ponerTema(esquema);
      await esperarA(TERMINO, "la apertura terminó de streamear");
      await ponerTema(esquema);
      await esperar(500);
      await capturar(`asistente-1-apertura-${esquema}`);

      // 2. una repregunta que trae la partida con su barra
      await evaluar(`(() => {
        const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        const i = document.querySelector('input[type="text"]');
        set.call(i, '¿Cómo vengo con el supermercado?');
        i.dispatchEvent(new Event('input', { bubbles: true }));
        i.closest('form').requestSubmit();
      })()`);
      await esperar(2000);
      await esperarA(TERMINO, "la respuesta terminó de streamear");
      await ponerTema(esquema);
      await esperar(500);
      await evaluar("window.scrollTo(0, document.body.scrollHeight)");
      await esperar(400);
      await capturar(`asistente-2-partida-${esquema}`);
    }

    navegador.cerrar();
  } finally {
    chrome.kill();
  }
  console.log(`\nListo → ${SALIDA}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
