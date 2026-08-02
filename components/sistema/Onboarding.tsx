"use client";

import { useEffect, useState } from "react";
import {
  Camera,
  CreditCard,
  Inbox,
  Lock,
  Plus,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  CLAVE_ONBOARDING,
  PASOS_ONBOARDING,
} from "@/lib/dominio/onboarding";
import { Badge } from "./Badge";
import { CardPartida } from "./CardPartida";
import { Chip } from "./Chip";
import { FilaMovimiento } from "./FilaMovimiento";
import { IconoCategoria } from "./IconoCategoria";
import { Importe } from "./Importe";

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

// La viñeta de cada paso: el sistema mostrándose a sí mismo. Antes el paso
// contaba con palabras lo que la app dibuja con componentes (y el de la cámara
// describía un botón que este mismo modal tapa); ahora cada paso trae una
// mini-vista armada con los componentes reales del sistema donde alcanzan
// (CardPartida, FilaMovimiento, Badge, Chip) y réplicas con los mismos tokens
// donde el real es navegación (la pastilla) o requiere datos (la bandeja).
// Datos de mentira FIJOS: la viñeta enseña la anatomía, no un estado de cuenta.
function MiniVista({ paso }: { paso: string }) {
  switch (paso) {
    case "wallet":
      // el sobre tal cual se ve en Presupuesto: nombre, "queda", barrita, meta
      return (
        <div className="rounded-card border border-borde bg-superficie text-left shadow-card">
          <CardPartida
            nombre="Supermercado"
            icono="shopping-cart"
            asignadoCentavos={45000000}
            gastadoCentavos={19840000}
            estado="ok"
          />
        </div>
      );
    case "camera":
      // réplica chica de la pastilla del TabBar — que este modal está tapando
      return (
        <div className="flex justify-center">
          <div className="flex items-center rounded-full bg-verde text-papel shadow-fab">
            <span className="flex h-[46px] w-[52px] items-center justify-center rounded-l-full">
              <Camera className="size-5" strokeWidth={2} aria-hidden />
            </span>
            <span aria-hidden className="h-[22px] w-px bg-black/30" />
            <span className="flex h-[46px] w-[52px] items-center justify-center rounded-r-full">
              <Plus className="size-[22px]" strokeWidth={2.4} aria-hidden />
            </span>
          </div>
        </div>
      );
    case "inbox":
      // la card de la bandeja: borde cálido, contador ámbar, fila sin categoría
      // y los chips sugeridos abiertos
      return (
        <div className="rounded-card border border-borde-bandeja bg-superficie text-left shadow-card">
          <div className="flex items-center gap-2 px-3.5 pt-3 pb-1.5">
            <Inbox className="size-[15px] text-ambar" strokeWidth={1.5} aria-hidden />
            <p className="text-[13.5px] font-semibold text-tinta">Bandeja de entrada</p>
            <span className="cifra ml-auto flex h-5 min-w-5 items-center justify-center rounded-[10px] bg-ambar px-1.5 text-[11px] font-semibold text-blanco">
              2
            </span>
          </div>
          <div className="flex items-center gap-[11px] border-t border-separador px-3.5 py-[9px]">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-tinta">Coto Digital</p>
              <p className="mt-0.5 truncate text-[11px] text-tinta-secundaria">
                hoy · Visa •• 4321
              </p>
            </div>
            <Importe centavos={4830000} variante="fila" />
          </div>
          <div className="flex flex-wrap gap-1.5 px-3.5 pb-3">
            <Chip escala="mini" disabled>
              <IconoCategoria nombre="shopping-cart" className="size-[13px]" />
              Supermercado
            </Chip>
            <Chip escala="mini" disabled>
              <IconoCategoria nombre="utensils" className="size-[13px]" />
              Comida afuera
            </Chip>
            <Chip escala="mini" disabled>
              todas →
            </Chip>
          </div>
        </div>
      );
    case "credit-card":
      // un consumo en cuotas: el cierre en ámbar y el badge CUOTA, de verdad
      return (
        <div className="rounded-card border border-borde bg-superficie text-left shadow-card">
          <FilaMovimiento
            descripcion="Vuelo a Salta"
            icono="plane"
            metadata="Viajes · Visa •• 4321"
            metadataCiclo="cierra 28 jul"
            importeCentavos={8940000}
            badgeCuota="cuota 3/6"
          />
        </div>
      );
    case "lock":
      // los dos ámbitos, lado a lado, con el Badge real
      return (
        <div className="flex items-center justify-center gap-2 rounded-card border border-borde bg-superficie px-3.5 py-4 shadow-card">
          <Badge variante="hogar">hogar</Badge>
          <Badge variante="personal">personal</Badge>
        </div>
      );
    case "sparkles":
      // como en el asistente: la pregunta es un encabezado tenue y la
      // respuesta llega con tus números — cifra en mono
      return (
        <div className="text-left">
          <p className="text-[12.5px] font-semibold text-tinta-secundaria">
            ¿Cuánto va el súper?
          </p>
          <div className="mt-2 inline-block rounded-card border border-borde bg-superficie px-3.5 py-2.5 shadow-card">
            <p className="text-[13px] leading-[1.55] text-tinta">
              Van <span className="cifra font-semibold">$ 198.400</span> de{" "}
              <span className="cifra font-semibold">$ 450.000</span>. Venís bien.
            </p>
          </div>
        </div>
      );
    default:
      return null;
  }
}

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
        {/* la viñeta: decorativa y quieta (los lectores ya tienen el cuerpo) */}
        <div
          aria-hidden
          className="pointer-events-none mt-7 w-full max-w-[300px] select-none"
        >
          <MiniVista paso={p.icono} />
        </div>
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
