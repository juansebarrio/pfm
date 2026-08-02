"use client";

import { useActionState } from "react";
import { cambiarClave } from "./acciones";

export function FormularioClaveNueva() {
  const [estado, despachar, pendiente] = useActionState(cambiarClave, {});

  return (
    <form action={despachar} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-tinta-secundaria">
          Contraseña nueva
        </span>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="h-12 rounded-cta border border-borde bg-superficie px-3.5 text-[15px] text-tinta"
          placeholder="Mínimo 8 caracteres"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-tinta-secundaria">
          Repetir contraseña
        </span>
        <input
          type="password"
          name="confirmacion"
          required
          minLength={8}
          autoComplete="new-password"
          className="h-12 rounded-cta border border-borde bg-superficie px-3.5 text-[15px] text-tinta"
          placeholder="La misma de arriba"
        />
      </label>

      {estado.error && (
        <p role="alert" className="text-[12.5px] font-medium text-rojo">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="mt-2 h-[50px] rounded-cta bg-verde text-[15px] font-semibold text-papel disabled:opacity-60"
      >
        {pendiente ? "Guardando…" : "Guardar la clave nueva"}
      </button>
    </form>
  );
}
