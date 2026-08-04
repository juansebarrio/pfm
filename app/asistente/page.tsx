// Asistente financiero (pushed, sin tab bar): chat con la API de Anthropic
// usando los datos reales del hogar como contexto. Solo existe cuando hay
// ANTHROPIC_API_KEY configurada; sin ella, la feature está apagada.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { categoriasDelHogar, mediosDePago } from "@/lib/datos/movimientos";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { hoyBA } from "@/lib/dominio/fechas";
import { Chat } from "./Chat";

export const metadata: Metadata = { title: "Asistente — Fin de mes" };

export default async function Asistente() {
  if (!process.env.ANTHROPIC_API_KEY) redirect("/resumen");

  const sesion = await obtenerSesionHogar();
  // Medios y categorías se cargan acá y no cuando llega un comprobante: al
  // confirmar la lectura no queremos una espera más, y son datos chicos.
  const [medios, categorias] = await Promise.all([
    mediosDePago(sesion),
    categoriasDelHogar(sesion),
  ]);

  // El encabezado lo arma Chat: necesita el botón de reiniciar, que es estado
  // de cliente, en la misma fila que el título.
  return (
    <div className="flex min-h-dvh flex-col px-5 pt-14 lg:mx-auto lg:w-full lg:max-w-[640px]">
      <Chat
        nombre={sesion.nombreMiembro}
        medios={medios}
        categorias={categorias}
        hoy={hoyBA()}
      />
    </div>
  );
}
