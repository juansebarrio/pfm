"use client";

// Chip/píldora seleccionable del export en sus tres escalas.
// medio: chips de medio de pago (03, radio 10); filtro: 05/08 (radio 9);
// mini: categorías inline de la bandeja y chips de TC (radio 8).

type Escala = "medio" | "filtro" | "mini";

const escalas: Record<Escala, string> = {
  medio: "rounded-chip px-3.5 py-2 text-[12.5px]",
  filtro: "rounded-chip-chico px-2.5 py-1.5 text-[12px]",
  mini: "rounded-chip-mini px-2 py-1 text-[11.5px]",
};

type Props = {
  escala?: Escala;
  seleccionado?: boolean;
  /** oscuro: seleccionado en tinta (Visa •• 4321, Hogar, MEP); verde: borde verde (categoría) */
  tonoSeleccion?: "oscuro" | "verde";
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function Chip({
  escala = "filtro",
  seleccionado = false,
  tonoSeleccion = "oscuro",
  onClick,
  disabled,
  className = "",
  children,
}: Props) {
  const base = seleccionado
    ? tonoSeleccion === "oscuro"
      ? "bg-tinta text-papel border border-tinta font-semibold"
      : "bg-verde-suave text-verde border-[1.5px] border-verde font-semibold"
    : "bg-superficie text-tinta-secundaria border border-borde font-medium";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={seleccionado}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap transition-colors ${escalas[escala]} ${base} ${className}`}
    >
      {children}
    </button>
  );
}
