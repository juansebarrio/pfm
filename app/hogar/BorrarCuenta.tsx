"use client";

import { useState, useTransition } from "react";
import { borrarMiCuenta } from "@/app/(auth)/acciones";

// Borrar la cuenta. Va abajo de todo, en gris hasta que la abrís: no es una
// acción que uno busque por accidente. Pide escribir la palabra porque no se
// puede deshacer y no hay papelera.

const PALABRA = "BORRAR";

export function BorrarCuenta({ soloMiembro }: { soloMiembro: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  if (!abierto) {
    return (
      <p className="mt-8 text-center">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="hit-44 text-[12.5px] text-tinta-terciaria underline underline-offset-2"
        >
          Borrar mi cuenta
        </button>
      </p>
    );
  }

  return (
    <div className="mt-8 rounded-card border border-rojo/40 p-4">
      <h2 className="text-[15px] font-semibold text-tinta">Borrar mi cuenta</h2>
      <p className="mt-2 text-[13px] leading-[1.6] text-tinta-secundaria">
        {soloMiembro
          ? "Se borra tu hogar completo: movimientos, presupuestos, cuentas, tarjetas y patrimonio. No se puede deshacer."
          : "Se borra tu usuario y todo lo personal. Lo compartido del hogar queda para los demás miembros. No se puede deshacer."}
      </p>

      <label
        htmlFor="confirmacion"
        className="mt-4 block text-[12.5px] text-tinta-secundaria"
      >
        Escribí <strong className="font-semibold text-tinta">{PALABRA}</strong> para
        confirmar
      </label>
      <input
        id="confirmacion"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        autoComplete="off"
        className="mt-1.5 h-11 w-full rounded-cta border border-borde bg-superficie px-3.5 text-[16px] text-tinta"
      />

      {error && <p className="mt-3 text-[12.5px] font-medium text-rojo">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setTexto("");
            setError(null);
          }}
          className="hit-44 flex-1 rounded-cta border border-borde py-3 text-[14px] font-medium text-tinta"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={texto !== PALABRA || pendiente}
          onClick={() =>
            iniciar(async () => {
              // en el camino feliz esto redirige y nunca vuelve
              const r = await borrarMiCuenta();
              setError(r.error);
            })
          }
          className="hit-44 flex-1 rounded-cta bg-rojo py-3 text-[14px] font-semibold text-blanco disabled:opacity-40"
        >
          {pendiente ? "Borrando…" : "Borrar"}
        </button>
      </div>
    </div>
  );
}
