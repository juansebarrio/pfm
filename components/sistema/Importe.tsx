import { formatearImporte, type Moneda } from "@/lib/dominio/dinero";

// Tamaños de cifra del export (DESIGN_AUDIT.md §2.2): toda cifra en mono.
const variantes = {
  "hero-alta": "text-[52px] font-medium tracking-[-0.03em]", // "$ 84.320" (03)
  hero: "text-[40px] font-medium tracking-[-0.02em]", // disponible (01a), comprometido (07)
  card: "text-[34px] font-medium tracking-[-0.02em]", // resumen (04)
  proyectado: "text-[30px] font-medium tracking-[-0.02em]", // resumen proyectado (06)
  patrimonio: "text-[28px] font-medium tracking-[-0.02em] whitespace-nowrap", // total (08)
  fila: "text-[13px] font-semibold", // monto de fila
  "fila-chica": "text-[12.5px] font-semibold", // tenencias
  editable: "text-[14px] font-semibold", // montos de 02
  meta: "text-[11px] font-normal", // "$ 268.400 de $ 520.000"
  condensado: "text-[12px] font-semibold", // header condensado
} as const;

type Props = {
  centavos: number;
  moneda?: Moneda;
  variante?: keyof typeof variantes;
  /** "+ $ 120.000" para ingresos */
  conSigno?: boolean;
  className?: string;
};

export function Importe({
  centavos,
  moneda = "ARS",
  variante = "fila",
  conSigno = false,
  className = "",
}: Props) {
  const texto = formatearImporte(Math.abs(centavos), moneda);
  const prefijo = conSigno && centavos > 0 ? "+ " : centavos < 0 ? "− " : "";
  return (
    <span className={`cifra ${variantes[variante]} ${className}`}>
      {prefijo}
      {texto}
    </span>
  );
}
