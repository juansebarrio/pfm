// Pantalla 09 — Hogar (pushed, sin tab bar): miembros con rol, invitaciones
// pendientes con sus acciones, invitar por email y el statement de
// visibilidad hogar/personal. Cierra con "Cerrar sesión", sobrio (no está
// en el export, pero hace falta para probar con dos usuarios).
import Link from "next/link";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Lock, Users, Wallet } from "lucide-react";
import { cerrarSesion } from "@/app/(auth)/acciones";
import { Badge } from "@/components/sistema/Badge";
import { Card } from "@/components/sistema/Card";
import { obtenerHogar } from "@/lib/datos/hogar";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { HUSO, diasEntre, hoyBA } from "@/lib/dominio/fechas";
import { AccionesInvitacion } from "./AccionesInvitacion";
import { CambiadorTema } from "./CambiadorTema";
import { Invitar } from "./Invitar";

function inicial(texto: string): string {
  return (texto.trim()[0] ?? "?").toUpperCase();
}

/** "invitada hoy" / "invitada hace 1 día" / "invitada hace N días", en BA. */
function etiquetaInvitada(creadoEl: string, hoy: string): string {
  const fecha = format(new TZDate(creadoEl, HUSO), "yyyy-MM-dd");
  const dias = Math.max(0, diasEntre(fecha, hoy));
  const cuando =
    dias === 0 ? "invitada hoy" : dias === 1 ? "invitada hace 1 día" : `invitada hace ${dias} días`;
  return `${cuando} · sin responder`;
}

/** "los ve Juanse" / "los ven Juanse y Vale" / "los ven A, B y C". */
function losVen(nombres: string[]): string {
  if (nombres.length <= 1) return `los ve ${nombres[0] ?? "el hogar"}`;
  return `los ven ${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

export default async function Hogar() {
  const sesion = await obtenerSesionHogar();
  const hogar = await obtenerHogar(sesion);
  const hoy = hoyBA();

  const nMiembros = hogar.miembros.length;
  const nInvitaciones = hogar.invitacionesPendientes.length;
  const subtitulo =
    `${nMiembros} ${nMiembros === 1 ? "miembro" : "miembros"}` +
    (nInvitaciones > 0
      ? ` · ${nInvitaciones} ${
          nInvitaciones === 1 ? "invitación pendiente" : "invitaciones pendientes"
        }`
      : "");

  return (
    <div className="px-5 pt-14 pb-10">
      <header className="flex items-center gap-2.5">
        <Link href="/resumen" aria-label="Volver al resumen" className="hit-44 text-tinta">
          <ChevronLeft className="size-5" strokeWidth={1.5} aria-hidden />
        </Link>
        <h1 className="text-[17px] font-semibold text-tinta">Hogar</h1>
      </header>

      {/* Card del hogar: header + filas de miembros e invitaciones (§3.31) */}
      <Card className="mt-4 divide-y divide-separador">
        <div className="flex items-center gap-2.5 px-4 py-3.5">
          <Users className="size-[17px] shrink-0 text-tinta" strokeWidth={1.5} aria-hidden />
          <div className="min-w-0">
            <h2 className="truncate text-[16px] font-semibold text-tinta">{hogar.nombre}</h2>
            <p className="text-[11.5px] text-tinta-secundaria">{subtitulo}</p>
          </div>
        </div>

        {hogar.miembros.map((m) => (
          <div key={m.userId} className="flex items-center gap-3 px-4 py-3">
            {/* Avatar 36px (§3.30): tinta para vos, tinta-secundaria para el resto */}
            <div
              aria-hidden
              className={`flex size-9 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-papel ${
                m.esUsuarioActual ? "bg-tinta" : "bg-tinta-secundaria"
              }`}
            >
              {inicial(m.nombre)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-tinta">{m.nombre}</p>
              {(m.esUsuarioActual || m.descripcion) && (
                <p className="truncate text-[11.5px] text-tinta-secundaria">
                  {m.esUsuarioActual ? "vos" : m.descripcion}
                </p>
              )}
            </div>
            <Badge variante={m.rol}>{m.rol}</Badge>
          </div>
        ))}

        {hogar.invitacionesPendientes.map((inv) => (
          <div key={inv.id} className="px-4 py-3">
            <div className="flex items-center gap-3">
              {/* Avatar pendiente: punteado ámbar, mismo lenguaje que ESTIMADA */}
              <div
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-borde-estimada bg-fondo-estimada text-[14px] font-semibold text-ambar-texto"
              >
                {inicial(inv.email)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-tinta">{inv.email}</p>
                <p className="text-[11.5px] text-tinta-secundaria">
                  {etiquetaInvitada(inv.creadoEl, hoy)}
                </p>
              </div>
              <Badge variante="pendiente">pendiente</Badge>
            </div>
            <AccionesInvitacion invitacionId={inv.id} email={inv.email} />
          </div>
        ))}
      </Card>

      {/* Card-fila de navegación a la gestión de cuentas y tarjetas */}
      <Card className="mt-4">
        <Link href="/cuentas" className="flex items-center gap-2.5 px-4 py-3.5">
          <Wallet className="size-[17px] shrink-0 text-tinta" strokeWidth={1.5} aria-hidden />
          <span className="flex-1 text-[14px] font-medium text-tinta">Cuentas y tarjetas</span>
          <ChevronRight
            className="size-4 shrink-0 text-tinta-terciaria"
            strokeWidth={1.5}
            aria-hidden
          />
        </Link>
      </Card>

      {/* Tema claro/oscuro/auto persistido (tanda 8) */}
      <CambiadorTema />

      <div className="mt-4">
        <Invitar />
        <p className="mt-2 text-center text-[11.5px] text-tinta-secundaria">
          Por email. La persona elige su clave al entrar.
        </p>
      </div>

      {/* Card de visibilidad: candado + statement + badges explicados */}
      <Card className="mt-4 px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          <Lock className="mt-px size-[17px] shrink-0 text-tinta" strokeWidth={1.5} aria-hidden />
          <h2 className="text-[13.5px] leading-[1.5] font-semibold text-tinta">
            Lo personal es tuyo. Lo compartido lo ven los adultos del hogar.
          </h2>
        </div>
        <dl className="mt-3 flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <dt className="shrink-0">
              <Badge variante="hogar">hogar</Badge>
            </dt>
            <dd className="text-[11.5px] leading-[1.5] text-tinta-secundaria">
              presupuesto y movimientos compartidos:{" "}
              {losVen(hogar.miembros.map((m) => m.nombre))}
            </dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="shrink-0">
              <Badge variante="personal">personal</Badge>
            </dt>
            <dd className="text-[11.5px] leading-[1.5] text-tinta-secundaria">
              tus partidas privadas: solo las ves vos
            </dd>
          </div>
        </dl>
      </Card>

      <form action={cerrarSesion} className="mt-6 text-center">
        <button type="submit" className="hit-44 text-[13px] font-medium text-rojo">
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
