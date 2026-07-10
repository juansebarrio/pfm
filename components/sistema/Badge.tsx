// Tags de estado en mayúsculas. Escala unificada (mejora directa §7.1):
// 8.5px / 600 / ls .08em / padding 2px 5px / radio 4px.
// El punteado ámbar es el lenguaje "todavía no es un hecho" (ESTIMADA, PENDIENTE).

type Variante =
  | "hogar"
  | "personal"
  | "estimada"
  | "confirmada"
  | "rollover"
  | "cuota"
  | "pendiente"
  | "administrador"
  | "miembro"
  | "neutro";

const estilos: Record<Variante, string> = {
  hogar: "border border-borde bg-superficie text-tinta-secundaria",
  personal: "border border-borde bg-superficie text-tinta-secundaria",
  estimada: "border border-dashed border-borde-estimada bg-fondo-estimada text-ambar-texto",
  pendiente: "border border-dashed border-borde-estimada bg-fondo-estimada text-ambar-texto",
  confirmada: "bg-verde-suave text-verde",
  rollover: "bg-azul-suave text-azul",
  cuota: "cifra bg-separador text-tinta-secundaria tracking-[0.05em]",
  administrador: "border border-borde bg-superficie text-tinta-secundaria",
  miembro: "border border-borde bg-superficie text-tinta-secundaria",
  neutro: "border border-borde bg-superficie text-tinta-secundaria",
};

export function Badge({
  variante,
  children,
}: {
  variante: Variante;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-block rounded-tag px-[5px] py-[2px] text-[8.5px] font-semibold tracking-[0.08em] uppercase ${estilos[variante]}`}
    >
      {children}
    </span>
  );
}
