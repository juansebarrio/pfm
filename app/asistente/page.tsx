// Asistente financiero (pushed, sin tab bar): chat con la API de Anthropic
// usando los datos reales del hogar como contexto. Solo existe cuando hay
// ANTHROPIC_API_KEY configurada; sin ella, la feature está apagada.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { Chat } from "./Chat";

export const metadata: Metadata = { title: "Asistente — Fin de mes" };

export default async function Asistente() {
  if (!process.env.ANTHROPIC_API_KEY) redirect("/resumen");

  const sesion = await obtenerSesionHogar();

  // El encabezado lo arma Chat: necesita el botón de reiniciar, que es estado
  // de cliente, en la misma fila que el título.
  return (
    <div className="flex min-h-dvh flex-col px-5 pt-14">
      <Chat nombre={sesion.nombreMiembro} />
    </div>
  );
}
