// CTA primario unificado (mejora directa §7.1): radio 12, padding vertical 15,
// Rubik 600 15px. En dark el texto va en papel (#141312) sobre verde claro.

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  ancho?: "completo" | "contenido";
};

export function BotonPrimario({
  ancho = "completo",
  className = "",
  children,
  ...resto
}: Props) {
  return (
    <button
      {...resto}
      className={`rounded-cta bg-verde py-[15px] text-[15px] font-semibold text-papel disabled:opacity-60 ${
        ancho === "completo" ? "w-full" : "px-[30px]"
      } ${className}`}
    >
      {children}
    </button>
  );
}
