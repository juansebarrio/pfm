"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aceptarInvitacion } from "@/app/acciones/hogar";
import { BotonPrimario } from "@/components/sistema/BotonPrimario";
import { Card } from "@/components/sistema/Card";

export function AceptarInvitacion({
  token,
  nombreSugerido,
}: {
  token: string;
  nombreSugerido: string;
}) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [nombre, setNombre] = useState(nombreSugerido);
  const [error, setError] = useState<string | null>(null);

  function aceptar() {
    if (!nombre.trim() || pendiente) return;
    setError(null);
    iniciarTransicion(async () => {
      const resultado = await aceptarInvitacion({ token, nombre: nombre.trim() });
      if (resultado.ok) {
        router.push("/resumen");
        router.refresh();
      } else {
        setError(resultado.error);
      }
    });
  }

  return (
    <Card className="p-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-tinta-secundaria">
          Tu nombre en el hogar
        </span>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={60}
          className="h-12 rounded-cta border border-borde bg-superficie px-3.5 text-[15px] text-tinta"
          placeholder="Sofi"
        />
      </label>
      {error && (
        <p role="alert" className="mt-2 text-[12.5px] font-medium text-rojo">
          {error}
        </p>
      )}
      <BotonPrimario
        className="mt-4"
        disabled={!nombre.trim() || pendiente}
        onClick={aceptar}
      >
        {pendiente ? "Sumándote…" : "Sumarme al hogar"}
      </BotonPrimario>
    </Card>
  );
}
