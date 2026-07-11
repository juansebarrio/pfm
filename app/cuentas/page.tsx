// Gestión de cuentas y tarjetas (hueco declarado del export, DESIGN_AUDIT §5:
// "la gestión de cuentas" — lista simple detrás del avatar). Pushed sin tab
// bar, como /hogar. Muestra TODOS los medios del hogar: activos primero,
// inactivos al final atenuados. Alta y edición en hojas inferiores.
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { ConexionGmail } from "./ConexionGmail";
import { SeccionCuentas, type CuentaFila } from "./HojaCuenta";
import { SeccionTarjetas, type TarjetaFila } from "./HojaTarjeta";

// mensajes de la vuelta del OAuth de conectar Gmail (?gmail=...)
const AVISOS_GMAIL: Record<string, string> = {
  "sin-permiso":
    "Google no dio el permiso de lectura. Probá de nuevo y aceptá el acceso a Gmail.",
  error: "No pudimos guardar la conexión. Probá de nuevo.",
};

/** Activas primero; dentro de cada grupo conserva el orden por creado_el. */
function activasPrimero<T extends { activa: boolean }>(filas: T[]): T[] {
  return [...filas].sort((a, b) => Number(b.activa) - Number(a.activa));
}

export default async function Cuentas({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string }>;
}) {
  const { gmail } = await searchParams;
  const conGoogle = process.env.NEXT_PUBLIC_GOOGLE === "true";

  const sesion = await obtenerSesionHogar();
  const [{ data: cuentas }, { data: tarjetas }] = await Promise.all([
    sesion.supabase
      .from("cuentas")
      .select("id, nombre, tipo, moneda, visibilidad, activa")
      .eq("hogar_id", sesion.hogarId)
      .order("creado_el", { ascending: true }),
    sesion.supabase
      .from("tarjetas")
      .select("id, nombre, banco, red, ultimos4, visibilidad, activa, dia_cierre, ciclos_tarjeta(id)")
      .eq("hogar_id", sesion.hogarId)
      .order("creado_el", { ascending: true }),
  ]);

  // las tablas de Gmail solo se consultan con el flag activo: sin él (y sin la
  // migración aplicada) tocarlas rompería la página. Columnas explícitas: el
  // token cifrado no es legible para el cliente.
  const [{ data: conexion }, { count: pendientes }] = conGoogle
    ? await Promise.all([
        sesion.supabase
          .from("conexiones_gmail")
          .select("email_gmail, ultima_sincronizacion")
          .eq("user_id", sesion.userId)
          .maybeSingle(),
        sesion.supabase
          .from("sugerencias_correo")
          .select("id", { count: "exact", head: true })
          .eq("user_id", sesion.userId)
          .eq("estado", "pendiente"),
      ])
    : [{ data: null }, { count: 0 }];

  const filasCuentas: CuentaFila[] = activasPrimero(
    (cuentas ?? []).map((c) => ({
      id: c.id,
      nombre: c.nombre,
      tipo: c.tipo,
      moneda: c.moneda,
      visibilidad: c.visibilidad,
      activa: c.activa,
    })),
  );

  const filasTarjetas: TarjetaFila[] = activasPrimero(
    (tarjetas ?? []).map((t) => ({
      id: t.id,
      nombre: t.nombre,
      banco: t.banco,
      red: t.red,
      ultimos4: t.ultimos4,
      visibilidad: t.visibilidad,
      activa: t.activa,
      diaCierre: t.dia_cierre,
      tieneCiclos: (t.ciclos_tarjeta as unknown as unknown[] | null)?.length ? true : false,
    })),
  );

  return (
    <div className="px-5 pt-14 pb-10">
      <header className="flex items-center gap-2.5">
        <Link href="/hogar" aria-label="Volver al hogar" className="hit-44 text-tinta">
          <ChevronLeft className="size-5" strokeWidth={1.5} aria-hidden />
        </Link>
        <h1 className="text-[17px] font-semibold text-tinta">Cuentas y tarjetas</h1>
      </header>

      <SeccionCuentas cuentas={filasCuentas} />
      <SeccionTarjetas tarjetas={filasTarjetas} />
      {conGoogle && (
        <ConexionGmail
          conexion={
            conexion
              ? {
                  email: conexion.email_gmail,
                  ultimaSincronizacion: conexion.ultima_sincronizacion,
                }
              : null
          }
          pendientes={pendientes ?? 0}
          aviso={gmail ? (AVISOS_GMAIL[gmail] ?? null) : null}
        />
      )}
    </div>
  );
}
