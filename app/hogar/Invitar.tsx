"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { invitarAlHogar, type ResultadoInvitacion } from "@/app/acciones/hogar";
import { BotonPrimario } from "@/components/sistema/BotonPrimario";
import { HojaInferior } from "@/components/sistema/HojaInferior";
import { LinkCompartible } from "./LinkCompartible";

// CTA "Invitar al hogar" + hoja inferior (09). Tras crear la invitación:
// si el email salió, aviso verde; si no (sin RESEND_API_KEY), el link
// para compartir a mano. El form se oculta para no invitar dos veces.

export function Invitar() {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const [email, setEmail] = useState("");
  const [resultado, setResultado] = useState<ResultadoInvitacion | null>(null);
  const [pendiente, iniciarTransicion] = useTransition();

  function cerrar() {
    setAbierta(false);
    setEmail("");
    setResultado(null);
  }

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    iniciarTransicion(async () => {
      const r = await invitarAlHogar({ email, rol: "miembro" });
      setResultado(r);
      if (r.ok) router.refresh();
    });
  }

  return (
    <>
      <BotonPrimario type="button" onClick={() => setAbierta(true)}>
        <span className="inline-flex items-center justify-center gap-2">
          <Mail className="size-4" strokeWidth={1.5} aria-hidden />
          Invitar al hogar
        </span>
      </BotonPrimario>

      <HojaInferior abierta={abierta} onCerrar={cerrar} titulo="Invitar al hogar">
        {resultado?.ok ? (
          resultado.enviado ? (
            <p role="status" className="text-[12.5px] font-medium text-verde">
              Invitación enviada a {email}.
            </p>
          ) : (
            <LinkCompartible link={resultado.link} />
          )
        ) : (
          <form onSubmit={enviar} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-tinta-secundaria">Email</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-cta border border-borde bg-superficie px-3.5 text-[15px] text-tinta placeholder:text-tinta-terciaria"
                placeholder="nombre@email.com"
              />
            </label>

            {resultado && !resultado.ok && (
              <p role="alert" className="text-[12.5px] font-medium text-rojo">
                {resultado.error}
              </p>
            )}

            <BotonPrimario type="submit" disabled={pendiente}>
              {pendiente ? "Enviando…" : "Enviar invitación"}
            </BotonPrimario>
          </form>
        )}
      </HojaInferior>
    </>
  );
}
