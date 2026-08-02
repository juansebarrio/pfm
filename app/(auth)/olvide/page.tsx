import type { Metadata } from "next";
import { EncabezadoAuth } from "../EncabezadoAuth";
import { FormularioOlvide } from "../FormularioOlvide";
import { PieAuth } from "../FormularioAuth";

export const metadata: Metadata = {
  title: "Recuperar contraseña — Fin de mes",
};

export default function Olvide() {
  return (
    <div className="flex min-h-dvh flex-col justify-center px-5 py-10">
      <EncabezadoAuth subtitulo="Poné el email de tu cuenta y te mandamos un correo para cambiar la clave." />
      <FormularioOlvide />
      <PieAuth
        pregunta="¿Te acordaste la clave?"
        href="/login"
        texto="Entrá desde acá"
      />
    </div>
  );
}
