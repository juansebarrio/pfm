"use client";

import { useActionState } from "react";
import { mandarCorreoRecuperacion } from "./acciones";

export function FormularioOlvide() {
  const [estado, despachar, pendiente] = useActionState(
    mandarCorreoRecuperacion,
    {},
  );

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
        {pendiente ? "Mandando…" : "Mandame el correo"}
      </button>
    </form>
  );
}
