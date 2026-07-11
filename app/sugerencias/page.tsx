// Sugerencias del correo: los mails de consumo detectados esperan acá a que
// el usuario los convierta en movimientos (o los descarte). Página pushed sin
// tab bar, como /cuentas. Personales: cada uno ve solo lo de SU casilla.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { categoriasDelHogar, mediosDePago } from "@/lib/datos/movimientos";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { RevisionSugerencias, type SugerenciaFila } from "./RevisionSugerencias";

export const metadata: Metadata = { title: "Sugerencias del correo — Fin de mes" };

export default async function Sugerencias() {
  // sin el flag (y sin la migración), la tabla no existe: la feature no aplica
  if (process.env.NEXT_PUBLIC_GOOGLE !== "true") redirect("/resumen");

  const sesion = await obtenerSesionHogar();
  const [{ data: sugerencias }, medios, categorias] = await Promise.all([
    sesion.supabase
      .from("sugerencias_correo")
      .select("id, fecha, tipo, importe_centavos, comercio, remitente, ultimos4, tarjeta_id")
      .eq("user_id", sesion.userId)
      .eq("estado", "pendiente")
      .order("fecha", { ascending: false }),
    mediosDePago(sesion),
    categoriasDelHogar(sesion),
  ]);

  const filas: SugerenciaFila[] = (sugerencias ?? []).map((s) => ({
    id: s.id,
    fecha: s.fecha,
    tipo: s.tipo,
    importeCentavos: s.importe_centavos,
    comercio: s.comercio,
    remitente: s.remitente,
    ultimos4: s.ultimos4,
    tarjetaId: s.tarjeta_id,
  }));

  return (
    <div className="px-5 pt-14 pb-10">
      <header className="flex items-center gap-2.5">
        <Link href="/resumen" aria-label="Volver al resumen" className="hit-44 text-tinta">
          <ChevronLeft className="size-5" strokeWidth={1.5} aria-hidden />
        </Link>
        <h1 className="text-[17px] font-semibold text-tinta">Sugerencias del correo</h1>
      </header>

      <RevisionSugerencias
        sugerencias={filas}
        medios={medios}
        categoriasHogar={categorias.filter((c) => c.ambito === "hogar")}
        categoriasPersonales={categorias.filter((c) => c.ambito === "personal")}
      />
    </div>
  );
}
