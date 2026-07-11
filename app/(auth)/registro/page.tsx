import type { Metadata } from "next";
import { BotonGoogle } from "../BotonGoogle";
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
  const conGoogle = process.env.NEXT_PUBLIC_GOOGLE === "true";

  return (
    <div className="flex min-h-dvh flex-col justify-center px-5 py-10">
      <EncabezadoAuth
        subtitulo={
          conGoogle
            ? "Creá tu cuenta con email o con Google. Después armás tu hogar e invitás a quien quieras."
            : "Creá tu cuenta con email y contraseña. Después podés armar tu hogar e invitar a quien quieras."
        }
      />
      <FormularioAuth
        accion={registrarse}
        textoCta="Crear cuenta"
        textoCtaPendiente="Creando…"
        volver={volver}
      />
      {/* crear la cuenta directamente con Google, sin contraseña */}
      {process.env.NEXT_PUBLIC_GOOGLE === "true" && <BotonGoogle volver={volver} />}
      <PieAuth
        pregunta="¿Ya tenés cuenta?"
        href={`/login${sufijo}`}
        texto="Entrá desde acá"
      />
    </div>
  );
}
