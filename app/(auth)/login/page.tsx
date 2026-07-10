import type { Metadata } from "next";
import { EncabezadoAuth } from "../EncabezadoAuth";
import { FormularioAuth, PieAuth } from "../FormularioAuth";
import { iniciarSesion } from "../acciones";

export const metadata: Metadata = { title: "Entrar — Sobres" };

export default function Login() {
  return (
    <div className="flex min-h-dvh flex-col justify-center px-5 py-10">
      <EncabezadoAuth subtitulo="Tu plata, por sobres. Presupuesto del hogar y personal, tarjetas con ciclos reales y patrimonio, hecho para Argentina." />
      <FormularioAuth
        accion={iniciarSesion}
        textoCta="Entrar"
        textoCtaPendiente="Entrando…"
      />
      <PieAuth
        pregunta="¿Primera vez?"
        href="/registro"
        texto="Creá tu cuenta"
      />
    </div>
  );
}
