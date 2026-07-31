"use client";

import { useEffect, useState } from "react";
import {
  Camera,
  CreditCard,
  Inbox,
  Lock,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  CLAVE_ONBOARDING,
  PASOS_ONBOARDING,
} from "@/lib/dominio/onboarding";

// El recorrido de bienvenida. El contenido vive en lib/dominio/onboarding.ts
// (compartido con el nativo); acá solo se dibuja: pantalla completa, un paso
// por vez, puntos de progreso y salida por "Saltar" o por el último paso.
//
// Se abre de DOS maneras: solo, la primera vez que entrás (OnboardingAuto,
// abajo, con localStorage); y siempre desde "Enseñame a utilizar la app" en
// Hogar. Verlo de nuevo no tiene costo: es un botón, no un estado.

const ICONOS: Record<string, LucideIcon> = {
  wallet: Wallet,
  camera: Camera,
  inbox: Inbox,
  "credit-card": CreditCard,
  lock: Lock,
  sparkles: Sparkles,
};

export function Onboarding({
  abierto,
  onCerrar,
}: {
  abierto: boolean;
  onCerrar: () => void;
}) {
  const [paso, setPaso] = useState(0);

  // cada apertura arranca del principio
  useEffect(() => {
    if (abierto) setPaso(0);
  }, [abierto]);

  if (!abierto) return null;

  const p = PASOS_ONBOARDING[paso];
  const Icono = ICONOS[p.icono] ?? Wallet;
  const esUltimo = paso === PASOS_ONBOARDING.length - 1;

  function cerrar() {
    try {
      localStorage.setItem(CLAVE_ONBOARDING, "1");
    } catch {
      // sin storage (modo privado estricto): se muestra de nuevo la próxima, no pasa nada
    }
    onCerrar();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cómo usar la app"
      className="fixed inset-0 z-50 mx-auto flex w-full max-w-[430px] flex-col bg-papel px-6 pt-[max(20px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]"
    >
      <div className="flex justify-end">
        <button
          type="button"
          onClick={cerrar}
          className="hit-44 text-[13px] font-medium text-tinta-secundaria"
        >
          Saltar
        </button>
      </div>

      {/* el paso, centrado verticalmente */}
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-verde-suave">
          <Icono className="size-9 text-verde" strokeWidth={1.5} aria-hidden />
        </div>
        <h2 className="mt-7 text-[24px] leading-[1.25] font-semibold text-tinta">
          {p.titulo}
        </h2>
        <p className="mt-3.5 max-w-[300px] text-[14.5px] leading-[1.6] text-tinta-secundaria">
          {p.cuerpo}
        </p>
      </div>

      {/* puntos + avance */}
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-2" aria-hidden>
          {PASOS_ONBOARDING.map((_, i) => (
            <span
              key={i}
              className={`rounded-full transition-all duration-200 ${
                i === paso ? "h-2 w-5 bg-verde" : "size-2 bg-tinta-muda"
              }`}
            />
          ))}
        </div>
        <div className="flex w-full items-center gap-2">
          {paso > 0 && (
            <button
              type="button"
              onClick={() => setPaso(paso - 1)}
              className="hit-44 shrink-0 px-3 text-[13.5px] font-medium text-tinta-secundaria"
            >
              Atrás
            </button>
          )}
          <button
            type="button"
            onClick={() => (esUltimo ? cerrar() : setPaso(paso + 1))}
            className="h-12 flex-1 rounded-cta bg-verde text-[15px] font-semibold text-papel"
          >
            {esUltimo ? "Listo, a usarla" : "Siguiente"}
          </button>
        </div>
        <p className="cifra text-[10.5px] text-tinta-terciaria">
          {paso + 1} de {PASOS_ONBOARDING.length}
        </p>
      </div>
    </div>
  );
}

/**
 * El disparo automático de la primera vez. Vive aparte del componente visual
 * para que las pantallas lo monten sin lógica: si localStorage ya tiene la
 * marca, no renderiza nada. La marca se escribe al CERRAR (no al abrir): si el
 * usuario recarga a mitad del recorrido, lo vuelve a ver entero, que es mejor
 * que perderse la mitad para siempre.
 */
export function OnboardingAuto() {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(CLAVE_ONBOARDING)) setAbierto(true);
    } catch {
      // sin storage no hay forma de recordar que ya se vio: mejor no insistir
    }
  }, []);

  return <Onboarding abierto={abierto} onCerrar={() => setAbierto(false)} />;
}
