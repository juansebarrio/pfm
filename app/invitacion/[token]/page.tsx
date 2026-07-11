import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { Card } from "@/components/sistema/Card";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { AceptarInvitacion } from "./AceptarInvitacion";

export const metadata: Metadata = { title: "Invitación — Sobres" };

// Ruta pública del token (tanda 6): "Por email. La persona elige su clave al
// entrar." Estados: inválida/vencida, sin sesión (login/registro con retorno),
// con sesión (elegís tu nombre y entrás al hogar).

export default async function PaginaInvitacion({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await crearClienteServidor();

  const [{ data: filas }, { data: auth }] = await Promise.all([
    supabase.rpc("leer_invitacion", { token_invitacion: token }),
    supabase.auth.getUser(),
  ]);
  const invitacion = (filas ?? [])[0] as
    | { hogar_nombre: string; email: string; estado: string; vence_el: string }
    | undefined;
  const usuario = auth.user ?? null;

  const valida =
    invitacion &&
    invitacion.estado === "pendiente" &&
    new Date(invitacion.vence_el).getTime() > Date.now();

  return (
    <div className="flex min-h-dvh flex-col justify-center px-5 py-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-verde-suave">
          <Mail className="size-7 text-verde" strokeWidth={1.5} aria-hidden />
        </div>
        <h1 className="mt-5 text-[19px] font-semibold text-tinta">
          {valida
            ? `Te invitaron al hogar ${invitacion.hogar_nombre}`
            : "Esta invitación no está disponible"}
        </h1>
        <p className="mt-2.5 max-w-[280px] text-[13.5px] leading-[1.55] text-tinta-secundaria">
          {valida
            ? "Presupuesto compartido del hogar; lo personal de cada uno sigue siendo privado."
            : "Puede haber vencido o sido revocada. Pedí que te la reenvíen."}
        </p>
      </div>

      {valida && !usuario && (
        <Card className="p-4">
          <p className="text-center text-[13px] text-tinta-secundaria">
            Para sumarte, primero creá tu cuenta o entrá con la tuya.
          </p>
          <div className="mt-4 flex flex-col gap-2.5">
            <Link
              href={`/registro?volver=${encodeURIComponent(`/invitacion/${token}`)}`}
              className="rounded-cta bg-verde py-[15px] text-center text-[15px] font-semibold text-papel"
            >
              Crear cuenta
            </Link>
            <Link
              href={`/login?volver=${encodeURIComponent(`/invitacion/${token}`)}`}
              className="rounded-cta border border-borde bg-superficie py-[15px] text-center text-[15px] font-medium text-verde"
            >
              Ya tengo cuenta
            </Link>
          </div>
        </Card>
      )}

      {valida && usuario && (
        <AceptarInvitacion
          token={token}
          nombreSugerido={
            (usuario.user_metadata?.nombre as string | undefined) ??
            usuario.email?.split("@")[0] ??
            ""
          }
        />
      )}

      {!valida && (
        <p className="text-center">
          <Link href="/login" className="text-[13.5px] font-medium text-verde">
            Ir a Sobres →
          </Link>
        </p>
      )}
    </div>
  );
}
