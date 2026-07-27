// Asistente financiero (pushed, sin tab bar): chat con la API de Anthropic
// usando los datos reales del hogar como contexto. Solo existe cuando hay
// ANTHROPIC_API_KEY configurada; sin ella, la feature está apagada.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { Chat } from "./Chat";

export const metadata: Metadata = { title: "Asistente — Fin de mes" };

export default async function Asistente() {
  if (!process.env.ANTHROPIC_API_KEY) redirect("/resumen");

  const sesion = await obtenerSesionHogar();

  return (
    <div className="flex min-h-dvh flex-col px-5 pt-14">
      <header className="flex items-center gap-2.5">
        <Link href="/resumen" aria-label="Volver al resumen" className="hit-44 text-tinta">
          <ChevronLeft className="size-5" strokeWidth={1.5} aria-hidden />
        </Link>
        <h1 className="text-[17px] font-semibold text-tinta">Asistente</h1>
      </header>

      <Chat nombre={sesion.nombreMiembro} />
    </div>
  );
}
