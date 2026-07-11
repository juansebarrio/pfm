"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reenviarInvitacion, revocarInvitacion } from "@/app/acciones/hogar";
import { LinkCompartible } from "./LinkCompartible";

// Acciones de la fila de invitación pendiente (09, §3.31): "Reenviar" verde
// y "Revocar" en rojo (único destructivo del sistema), alineadas al texto
// (padding-left 48px). El reenvío puede devolver el link sin mandar el
// email: se muestra inline bajo la fila, lo más sobrio posible.

type Props = {
  invitacionId: string;
  email: string;
};

export function AccionesInvitacion({ invitacionId, email }: Props) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function limpiar() {
    setLink(null);
    setAviso(null);
    setError(null);
  }

  function reenviar() {
    iniciarTransicion(async () => {
      limpiar();
      const r = await reenviarInvitacion({ invitacionId });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (r.enviado) setAviso(`Invitación reenviada a ${email}.`);
      else setLink(r.link);
      router.refresh();
    });
  }

  function revocar() {
    iniciarTransicion(async () => {
      limpiar();
      const r = await revocarInvitacion({ invitacionId });
      if (!r.ok) setError("No pudimos revocar la invitación.");
      router.refresh();
    });
  }

  return (
    <div className="pl-12">
      <div className="mt-0.5 flex items-center gap-4">
        <button
          type="button"
          onClick={reenviar}
          disabled={pendiente}
          aria-label={`Reenviar la invitación a ${email}`}
          className="hit-44 text-[12.5px] font-medium text-verde disabled:opacity-60"
        >
          Reenviar
        </button>
        <button
          type="button"
          onClick={revocar}
          disabled={pendiente}
          aria-label={`Revocar la invitación a ${email}`}
          className="hit-44 text-[12.5px] font-medium text-rojo disabled:opacity-60"
        >
          Revocar
        </button>
      </div>

      {aviso && (
        <p role="status" className="mt-1.5 text-[12.5px] font-medium text-verde">
          {aviso}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-rojo">
          {error}
        </p>
      )}
      {link && (
        <div className="mt-2">
          <LinkCompartible link={link} />
        </div>
      )}
    </div>
  );
}
