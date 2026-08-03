import type { Metadata } from "next";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { EncabezadoAuth } from "../EncabezadoAuth";
import { FormularioClaveNueva } from "../FormularioClaveNueva";

export const metadata: Metadata = { title: "Clave nueva — Fin de mes" };

// Acá aterriza el link del correo de recuperación, ya con la sesión que
// /auth/callback canjeó. Si no hay sesión (entraron directo o el enlace
// venció), en vez del formulario va un aviso amable con la salida a /olvide.

export default async function ClaveNueva() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-dvh flex-col justify-center px-5 py-10 lg:mx-auto lg:w-full lg:max-w-[480px]">
      <EncabezadoAuth
        subtitulo={
          user
            ? "Elegí tu contraseña nueva. Al guardarla entrás directo a tu resumen."
            : "Cambiá tu contraseña desde el link del correo de recuperación."
        }
      />
      {user ? (
        <FormularioClaveNueva />
      ) : (
        <p className="text-[13.5px] leading-[1.55] text-tinta-secundaria">
          El enlace venció, ya se usó o llegaste sin él.{" "}
          <Link href="/olvide" className="font-medium text-verde">
            Pedí un correo nuevo
          </Link>{" "}
          y entrá desde el link de tu casilla.
        </p>
      )}
    </div>
  );
}
