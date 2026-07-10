"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { EstadoAuth } from "./acciones";

type Props = {
  accion: (estado: EstadoAuth, formulario: FormData) => Promise<EstadoAuth>;
  textoCta: string;
  textoCtaPendiente: string;
};

export function FormularioAuth({ accion, textoCta, textoCtaPendiente }: Props) {
  const [estado, despachar, pendiente] = useActionState(accion, {});

  return (
    <form action={despachar} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-tinta-secundaria">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          className="h-12 rounded-cta border border-borde bg-superficie px-3.5 text-[15px] text-tinta placeholder:text-tinta-terciaria"
          placeholder="tu@email.com"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-tinta-secundaria">
          Contraseña
        </span>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="current-password"
          className="h-12 rounded-cta border border-borde bg-superficie px-3.5 text-[15px] text-tinta"
          placeholder="Mínimo 8 caracteres"
        />
      </label>

      {estado.error && (
        <p role="alert" className="text-[12.5px] font-medium text-rojo">
          {estado.error}
        </p>
      )}
      {estado.aviso && (
        <p role="status" className="text-[12.5px] font-medium text-verde">
          {estado.aviso}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="mt-2 h-[50px] rounded-cta bg-verde text-[15px] font-semibold text-papel disabled:opacity-60"
      >
        {pendiente ? textoCtaPendiente : textoCta}
      </button>
    </form>
  );
}

export function PieAuth({
  pregunta,
  href,
  texto,
}: {
  pregunta: string;
  href: string;
  texto: string;
}) {
  return (
    <p className="mt-5 text-center text-[13px] text-tinta-secundaria">
      {pregunta}{" "}
      <Link href={href} className="font-medium text-verde">
        {texto}
      </Link>
    </p>
  );
}
