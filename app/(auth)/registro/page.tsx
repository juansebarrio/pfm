import type { Metadata } from "next";
import { EncabezadoAuth } from "../EncabezadoAuth";
import { FormularioAuth, PieAuth } from "../FormularioAuth";
import { registrarse } from "../acciones";

export const metadata: Metadata = { title: "Crear cuenta — Fin de mes" };

export default async function Registro({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  const { volver } = await searchParams;
  const sufijo = volver ? `?volver=${encodeURIComponent(volver)}` : "";

  return (
    <div className="flex min-h-dvh flex-col justify-center px-5 py-10">
      <EncabezadoAuth subtitulo="Creá tu cuenta con email y contraseña. Después podés armar tu hogar e invitar a quien quieras." />
      <FormularioAuth
        accion={registrarse}
        textoCta="Crear cuenta"
        textoCtaPendiente="Creando…"
        volver={volver}
      />
      <PieAuth
        pregunta="¿Ya tenés cuenta?"
        href={`/login${sufijo}`}
        texto="Entrá desde acá"
      />
    </div>
  );
}
