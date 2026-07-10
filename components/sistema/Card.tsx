// Card contenedora del sistema: superficie blanca, borde hairline, radio 14,
// sombra sutil en claro (en dark, solo borde). Los hijos se separan con
// divisores via divide-*.

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-card border border-borde bg-superficie shadow-card ${className}`}
    >
      {children}
    </div>
  );
}

/** Header de sección de lista: Rubik 600 12px secundaria, gutter +2px óptico. */
export function EncabezadoSeccion({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-3.5 mb-1.5 px-0.5 text-[12px] font-semibold text-tinta-secundaria">
      {children}
    </h2>
  );
}
