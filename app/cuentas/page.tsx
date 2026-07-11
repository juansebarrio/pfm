// Gestión de cuentas y tarjetas (hueco declarado del export, DESIGN_AUDIT §5:
// "la gestión de cuentas" — lista simple detrás del avatar). Pushed sin tab
// bar, como /hogar. Muestra TODOS los medios del hogar: activos primero,
// inactivos al final atenuados. Alta y edición en hojas inferiores.
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { SeccionCuentas, type CuentaFila } from "./HojaCuenta";
import { SeccionTarjetas, type TarjetaFila } from "./HojaTarjeta";

/** Activas primero; dentro de cada grupo conserva el orden por creado_el. */
function activasPrimero<T extends { activa: boolean }>(filas: T[]): T[] {
  return [...filas].sort((a, b) => Number(b.activa) - Number(a.activa));
}

export default async function Cuentas() {
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
    </div>
  );
}
