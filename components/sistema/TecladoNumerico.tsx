"use client";

import { Delete } from "lucide-react";

// Teclado propio de la alta rápida (03): 12 teclas de 50px, cifras mono 22px,
// tecla "," para decimales y backspace con ícono. Operable con teclado físico
// (mejora directa §7.1): cada tecla es un botón real enfocable.

type Props = {
  onDigito: (d: string) => void;
  onComa: () => void;
  onBorrar: () => void;
};

const teclas = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function TecladoNumerico({ onDigito, onComa, onBorrar }: Props) {
  return (
    <div role="group" aria-label="Teclado numérico" className="grid grid-cols-3 gap-[7px]">
      {teclas.map((t) => (
        <Tecla key={t} onClick={() => onDigito(t)} etiqueta={t} />
      ))}
      <Tecla onClick={onComa} etiqueta="," ariaLabel="coma decimal" />
      <Tecla onClick={() => onDigito("0")} etiqueta="0" />
      <button
        type="button"
        onClick={onBorrar}
        aria-label="Borrar último dígito"
        className="flex h-[50px] items-center justify-center rounded-chip border border-borde bg-superficie text-tinta active:bg-separador"
      >
        <Delete className="size-5" strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );
}

function Tecla({
  etiqueta,
  onClick,
  ariaLabel,
}: {
  etiqueta: string;
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="cifra h-[50px] rounded-chip border border-borde bg-superficie text-[22px] font-medium text-tinta active:bg-separador"
    >
      {etiqueta}
    </button>
  );
}
