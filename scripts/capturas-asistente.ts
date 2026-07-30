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

/**
 * El comprobante de muestra que se sube para las capturas 3 y 4. Es un ticket
 * de supermercado armado a mano (no una foto de un ticket real de nadie), con
 * datos que existen en el hogar de demo: total $ 84.320, Visa terminada en
 * 4321. Vive en el repo para que las capturas sean reproducibles.
 */
const TICKET = path.join(process.cwd(), "docs/presentacion/muestra-ticket.png");

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
    // <html> (ver app/globals.css). Se fuerza después de cada navegación, y por
    // eso aparece repetido: cada Page.navigate lo resetea.
    //
    // Todas las capturas van en OSCURO: es el tema con el que se presenta el
    // producto, y un par claro/oscuro de cada pantalla duplicaba el material
    // sin agregar nada que contar.
    const ponerTema = () => evaluar(`document.documentElement.dataset.tema = 'oscuro'`);

    {
      console.log("");

      // 1. la lectura de apertura, sin que nadie haya escrito nada
      await pagina.enviar("Page.navigate", { url: `${BASE}/asistente` });
      await esperar(1500);
      await ponerTema();
      await esperarA(TERMINO, "la apertura terminó de streamear");
      await ponerTema();
      await esperar(500);
      await capturar("asistente-1-apertura");

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
      await ponerTema();
      await esperar(500);
      await evaluar("window.scrollTo(0, document.body.scrollHeight)");
      await esperar(400);
      await capturar("asistente-2-partida");

      // 3. y 4. el comprobante: la foto adjunta y la lectura para confirmar.
      //
      // La imagen se sube de verdad, por el input real, con DOM.setFileInputFiles
      // (la única forma de llenar un <input type=file> desde CDP: escribirle
      // .files desde JS no se puede, es de solo lectura por seguridad).
      await pagina.enviar("Page.navigate", { url: `${BASE}/asistente` });
      await esperar(1500);
      await ponerTema();
      await esperarA(TERMINO, "la apertura terminó de streamear");

      const { root } = await pagina.enviar<{ root: { nodeId: number } }>("DOM.getDocument");
      const { nodeId } = await pagina.enviar<{ nodeId: number }>("DOM.querySelector", {
        nodeId: root.nodeId,
        selector: 'input[type="file"]',
      });
      await pagina.enviar("DOM.setFileInputFiles", { nodeId, files: [TICKET] });
      await esperarA(
        "!!document.querySelector('img[alt=\"Comprobante a enviar\"]')",
        "la miniatura del adjunto apareció",
        20,
      );
      await ponerTema();
      await esperar(400);
      await evaluar("window.scrollTo(0, document.body.scrollHeight)");
      await capturar("asistente-3-adjunto");

      await evaluar("document.querySelector('button[aria-label=\"Enviar\"]').click()");
      await esperarA(
        "!!document.querySelector('input[aria-label=\"Importe\"]')",
        "la tarjeta de confirmación apareció",
      );
      // un momento más: los chips de medio y categoría se pintan con el stream
      await esperar(1500);
      await ponerTema();
      // El encuadre se elige por el BOTÓN, no por la tarjeta: "Cargar" es lo
      // que la captura tiene que contar. Centrar la tarjeta lo dejaba abajo del
      // compositor pegado, que es la parte más importante escondida.
      await evaluar(`(() => {
        const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().startsWith('Cargar'));
        b.scrollIntoView({ block: 'end' });
        window.scrollBy(0, 110); // el compositor sticky mide ~100px
      })()`);
      await esperar(500);
      await capturar("asistente-4-comprobante");
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
