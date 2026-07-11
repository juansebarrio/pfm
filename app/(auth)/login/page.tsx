import type { Metadata } from "next";
import { BotonDemo } from "../BotonDemo";
import { BotonGoogle } from "../BotonGoogle";
import { EncabezadoAuth } from "../EncabezadoAuth";
import { FormularioAuth, PieAuth } from "../FormularioAuth";
import { iniciarSesion } from "../acciones";

export const metadata: Metadata = { title: "Entrar — Fin de mes" };

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  const { volver } = await searchParams;
  const sufijo = volver ? `?volver=${encodeURIComponent(volver)}` : "";

  return (
    <div className="flex min-h-dvh flex-col justify-center px-5 py-10">
      <EncabezadoAuth subtitulo="Llegá tranquilo a fin de mes. Presupuesto del hogar y personal, tarjetas con ciclos reales y patrimonio, hecho para Argentina." />
      <FormularioAuth
        accion={iniciarSesion}
        textoCta="Entrar"
        textoCtaPendiente="Entrando…"
        volver={volver}
      />
      {/* con el proyecto de Google configurado: entrar sin contraseña */}
      {process.env.NEXT_PUBLIC_GOOGLE === "true" && <BotonGoogle volver={volver} />}
      <PieAuth
        pregunta="¿Primera vez?"
        href={`/registro${sufijo}`}
        texto="Creá tu cuenta"
      />
      {/* solo en la demo (producción): entrar sin credenciales */}
      {process.env.NEXT_PUBLIC_DEMO === "true" && <BotonDemo />}
    </div>
  );
}
