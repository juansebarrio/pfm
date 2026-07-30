import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// Política de privacidad. Es requisito de la App Store, y para apps de
// finanzas la revisión de Apple mira esto con lupa (docs/IOS-NATIVO.md §5.6).
// Es pública a propósito: el middleware la deja pasar sin sesión, porque hay
// que poder leerla ANTES de crear una cuenta.

export const metadata: Metadata = {
  title: "Privacidad — Fin de mes",
  description: "Qué datos guarda Fin de mes, dónde viven y cómo borrarlos.",
};

/** Fecha de la última revisión de fondo, no de cada retoque de redacción. */
const ACTUALIZADO = "27 de julio de 2026";

export default function Privacidad() {
  return (
    <div className="mx-auto min-h-dvh max-w-[680px] px-5 py-8">
      <Link
        href="/resumen"
        className="hit-44 inline-flex items-center gap-1.5 text-[13px] text-tinta-secundaria"
      >
        <ChevronLeft className="size-4" strokeWidth={1.5} aria-hidden />
        Volver
      </Link>

      <h1 className="mt-6 text-[26px] font-semibold text-tinta">Privacidad</h1>
      <p className="mt-2 text-[13px] text-tinta-terciaria">
        Última actualización: {ACTUALIZADO}
      </p>

      <p className="mt-6 text-[15px] leading-[1.65] text-tinta">
        Fin de mes es una app de finanzas personales. Guarda lo que cargás para
        poder mostrártelo: presupuesto, movimientos, tarjetas y patrimonio. No
        vende tus datos, no los usa para publicidad y no tiene rastreadores de
        terceros.
      </p>

      <Seccion titulo="Qué guardamos">
        <ul className="mt-3 space-y-2.5 text-[14px] leading-[1.6] text-tinta-secundaria">
          <Item t="Cuenta">
            Tu email y, si entrás con Google, el identificador que devuelve
            Google. La contraseña la guarda Supabase Auth con hash: nadie —
            nosotros incluidos — puede leerla.
          </Item>
          <Item t="Hogar">
            El nombre del hogar y el nombre con el que aparecés ante los otros
            miembros.
          </Item>
          <Item t="Tus finanzas">
            Cuentas, movimientos, categorías, presupuesto, compras en cuotas y
            tenencias. Todo lo cargás vos: la app no se conecta a tu banco.
          </Item>
          <Item t="Tarjetas">
            Nombre, banco, red y los <strong>últimos cuatro dígitos</strong>.
            Nunca el número completo, el vencimiento ni el código de seguridad:
            no hay dónde guardarlos.
          </Item>
        </ul>
      </Seccion>

      <Seccion titulo="Qué NO guardamos">
        <ul className="mt-3 space-y-2.5 text-[14px] leading-[1.6] text-tinta-secundaria">
          <Item t="Credenciales bancarias">
            No pedimos ni almacenamos usuarios ni claves de home banking.
          </Item>
          <Item t="Números de tarjeta completos">
            Ver arriba: solo los últimos cuatro.
          </Item>
          <Item t="Ubicación, contactos ni micrófono">
            La app no los pide.
          </Item>
          <Item t="Las fotos de comprobantes">
            La cámara y tus fotos se piden <em>solo</em> cuando vos elegís
            mandarle un comprobante al asistente, y la imagen no se guarda: se
            lee y se descarta. No queda copia en el teléfono, ni en nuestro
            servidor, ni en la base. Tampoco accedemos a tu galería: elegís vos
            qué foto mandar, de a una.
          </Item>
          <Item t="Analítica ni publicidad">
            No hay SDK de tracking, ni cookies de terceros, ni perfilado.
          </Item>
        </ul>
      </Seccion>

      <Seccion titulo="Quién ve qué">
        <p className="mt-3 text-[14px] leading-[1.65] text-tinta-secundaria">
          Cada dato es <strong>del hogar</strong> o <strong>personal</strong>.
          Lo del hogar lo ven todos los adultos del hogar; lo personal lo ves
          solo vos, incluso si compartís el hogar. Esto no es una convención de
          interfaz: está aplicado en la base con Row Level Security, así que
          una consulta de otra persona simplemente no devuelve tus filas
          personales.
        </p>
      </Seccion>

      <Seccion titulo="El asistente con IA">
        <p className="mt-3 text-[14px] leading-[1.65] text-tinta-secundaria">
          Si le preguntás algo al asistente, se le manda a la API de Anthropic
          un resumen de tus números de ese momento (totales del presupuesto,
          partidas, tarjetas próximas a cerrar, patrimonio) junto con tu
          pregunta. No se manda tu email ni tu nombre de usuario. La
          conversación no se guarda en ningún lado: cerrás la pantalla y se
          termina. Anthropic no entrena modelos con los datos que recibe por su
          API. Si nunca abrís el asistente, no sale nada.
        </p>
        <p className="mt-3 text-[14px] leading-[1.65] text-tinta-secundaria">
          Si le mandás la <strong>foto de un comprobante</strong>, esa imagen
          viaja por la misma vía y con el mismo trato: se usa para leer el
          movimiento y se descarta cuando termina la respuesta. No la guardamos
          ni queda adjunta al gasto — del comprobante solo sobrevive lo que vos
          confirmás cargar (comercio, importe, fecha) y una nota que dice que
          salió de una foto. La imagen se reduce en tu teléfono antes de salir.
        </p>
      </Seccion>

      <Seccion titulo="Gmail (opcional, desactivado por defecto)">
        <p className="mt-3 text-[14px] leading-[1.65] text-tinta-secundaria">
          Si conectás tu Gmail, la app lee <em>únicamente</em> los avisos de
          consumo que te mandan bancos y tarjetas, para sugerirte movimientos
          que después confirmás vos. No lee tu correo personal ni guarda el
          contenido de los mensajes: solo el dato del consumo (comercio,
          importe, fecha). Podés desconectarlo cuando quieras y se borra el
          permiso. Es opcional: la app funciona entera sin esto.
        </p>
      </Seccion>

      <Seccion titulo="En tu teléfono">
        <p className="mt-3 text-[14px] leading-[1.65] text-tinta-secundaria">
          La app de iPhone guarda tu sesión en el almacenamiento privado de la
          app. Si activás el bloqueo con Face ID, la validación la hace iOS: la
          app recibe un sí o un no y nunca ve tus datos biométricos. Los avisos
          de cierre y vencimiento se programan en el propio teléfono con fechas
          que ya están en tu cuenta — no hay un servidor mandándote
          notificaciones ni sabiendo cuándo las recibís.
        </p>
      </Seccion>

      <Seccion titulo="Dónde viven los datos">
        <p className="mt-3 text-[14px] leading-[1.65] text-tinta-secundaria">
          En Supabase (base de datos PostgreSQL administrada) y en Vercel, que
          sirve la aplicación. Ambos son proveedores de infraestructura que
          procesan los datos por cuenta nuestra. El tránsito va cifrado (HTTPS)
          y la base está cifrada en reposo.
        </p>
      </Seccion>

      <Seccion titulo="Borrar tu cuenta">
        <p className="mt-3 text-[14px] leading-[1.65] text-tinta-secundaria">
          Lo hacés vos, desde{" "}
          <Link href="/hogar" className="font-medium text-verde underline underline-offset-2">
            Hogar
          </Link>
          , abajo de todo. No hace falta pedírnoslo ni esperar.
        </p>
        <p className="mt-3 text-[14px] leading-[1.65] text-tinta-secundaria">
          Si sos la única persona del hogar, se borra el hogar completo:
          movimientos, presupuestos, cuentas, tarjetas y tenencias. Si compartís
          el hogar con alguien, se borra tu usuario y todo lo personal, pero lo
          compartido queda — es tanto de la otra persona como tuyo, y vaciarle
          el historial sin avisarle no sería correcto.
        </p>
        <p className="mt-3 text-[14px] leading-[1.65] text-tinta-secundaria">
          No quedan copias más allá de los respaldos operativos de la base, que
          rotan solos. Si algo falla, escribinos a{" "}
          <a
            href="mailto:contacto@juansebarrio.com"
            className="font-medium text-verde underline underline-offset-2"
          >
            contacto@juansebarrio.com
          </a>
          .
        </p>
      </Seccion>

      <Seccion titulo="Menores">
        <p className="mt-3 text-[14px] leading-[1.65] text-tinta-secundaria">
          Fin de mes está pensada para adultos que manejan el presupuesto de una
          casa. No está dirigida a menores de 13 años ni recolecta datos de
          ellos a sabiendas.
        </p>
      </Seccion>

      <Seccion titulo="Cambios">
        <p className="mt-3 text-[14px] leading-[1.65] text-tinta-secundaria">
          Si cambia algo de fondo — datos nuevos, un proveedor nuevo — se
          actualiza esta página y se cambia la fecha de arriba.
        </p>
      </Seccion>

      <p className="mt-10 border-t border-borde pt-6 text-[13px] leading-[1.6] text-tinta-terciaria">
        Dudas: <a href="mailto:contacto@juansebarrio.com" className="underline underline-offset-2">contacto@juansebarrio.com</a>
      </p>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-[17px] font-semibold text-tinta">{titulo}</h2>
      {children}
    </section>
  );
}

function Item({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden className="mt-[9px] size-1 shrink-0 rounded-full bg-tinta-terciaria" />
      <span>
        <strong className="font-medium text-tinta">{t}:</strong> {children}
      </span>
    </li>
  );
}
