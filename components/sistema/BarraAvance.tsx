// Barra de avance de 4px del export. El color es semántico: sale de
// estadoPartida(), no del porcentaje. La variante "pagada" (fija al 100 %)
// baja la opacidad a .4: "una fija pagada al 100 % se ve calma".

type Tono = "ok" | "pagada" | "atencion" | "excedido" | "tinta";

const colores: Record<Tono, string> = {
  ok: "bg-verde",
  pagada: "bg-verde opacity-40",
  atencion: "bg-ambar",
  excedido: "bg-rojo",
  tinta: "bg-tinta",
};

type Props = {
  /** 0 a 1 (se recorta a 1 para el dibujo) */
  progreso: number;
  tono: Tono;
  altura?: number;
  /** posición 0-1 del marcador vertical del día (barra del mes) */
  marcadorDia?: number;
  /** para lectores de pantalla: "gastado 52 % de $ 520.000" */
  etiqueta?: string;
  className?: string;
};

export function BarraAvance({
  progreso,
  tono,
  altura = 4,
  marcadorDia,
  etiqueta,
  className = "",
}: Props) {
  const ancho = Math.max(0, Math.min(1, progreso)) * 100;
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(ancho)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={etiqueta}
      className={`relative w-full rounded-[2px] bg-pista ${className}`}
      style={{ height: altura }}
    >
      <div
        className={`h-full rounded-[2px] ${colores[tono]}`}
        style={{ width: `${ancho}%` }}
      />
      {marcadorDia !== undefined && (
        <div
          aria-hidden
          className="absolute w-[2px] rounded-[1px] bg-verde"
          style={{
            left: `${Math.max(0, Math.min(1, marcadorDia)) * 100}%`,
            top: -3.5,
            height: altura + 7,
          }}
        />
      )}
    </div>
  );
}
