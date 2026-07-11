"use client";

import { useEffect, useState, useTransition } from "react";
import { entrarConGoogle } from "./acciones";

// "Continuar con Google". Solo se renderiza con NEXT_PUBLIC_GOOGLE=true
// (proyecto de Google configurado); la acción valida igual del lado server.

export function BotonGoogle({ volver }: { volver?: string }) {
  const [, iniciar] = useTransition();
  // estado propio (no useTransition): entrarConGoogle redirige a Google y el
  // transition quedaría colgado; así puedo destrabar el botón si vuelven con Back
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const alMostrar = (e: PageTransitionEvent) => {
      if (e.persisted) setAbriendo(false);
    };
    window.addEventListener("pageshow", alMostrar);
    return () => window.removeEventListener("pageshow", alMostrar);
  }, []);

  return (
    <div className="mt-5">
      <button
        type="button"
        disabled={abriendo}
        onClick={() => {
          setError(null);
          setAbriendo(true);
          iniciar(async () => {
            const r = await entrarConGoogle(volver);
            // si vuelve es porque falló (el éxito redirige a Google)
            if (r?.error) {
              setError(r.error);
              setAbriendo(false);
            }
          });
        }}
        className="flex h-[50px] w-full items-center justify-center gap-2.5 rounded-cta border border-borde bg-superficie text-[15px] font-semibold text-tinta disabled:opacity-60"
      >
        <LogoGoogle />
        {abriendo ? "Abriendo Google…" : "Continuar con Google"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-center text-[12.5px] font-medium text-rojo">
          {error}
        </p>
      )}
    </div>
  );
}

/** La "G" multicolor oficial, inline para no pedir assets externos. */
function LogoGoogle() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px]" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
