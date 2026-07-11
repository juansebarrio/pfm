import { formatearMesSolo, mesDe } from "@/lib/dominio/fechas";

// Sparkline de evolución patrimonial (DESIGN_AUDIT §3.29): SVG 108×40, línea
// tinta 1.5 round sin ejes, último punto con dot verde r2.5, caption mono
// 9.5px "ago 25 — jul 26" (primer y último snapshot). Server Component puro.

const ANCHO = 108;
const ALTO = 40;
const MARGEN = 4;

type Punto = { fecha: string; totalArsCentavos: number };

/** "2025-08-01" → "ago 25" */
function etiquetaMes(fecha: string): string {
  return `${formatearMesSolo(mesDe(fecha)).slice(0, 3)} ${fecha.slice(2, 4)}`;
}

export function Sparkline({ snapshots }: { snapshots: Punto[] }) {
  if (snapshots.length === 0) return null;

  const valores = snapshots.map((s) => s.totalArsCentavos);
  const minimo = Math.min(...valores);
  const rango = Math.max(...valores) - minimo;

  const puntos = snapshots.map((s, i) => {
    const x =
      snapshots.length === 1
        ? ANCHO / 2
        : MARGEN + (i * (ANCHO - MARGEN * 2)) / (snapshots.length - 1);
    const y =
      rango === 0
        ? ALTO / 2
        : ALTO - MARGEN - ((s.totalArsCentavos - minimo) * (ALTO - MARGEN * 2)) / rango;
    return [Number(x.toFixed(1)), Number(y.toFixed(1))] as const;
  });
  const ultimo = puntos[puntos.length - 1];

  const primero = etiquetaMes(snapshots[0].fecha);
  const final = etiquetaMes(snapshots[snapshots.length - 1].fecha);
  const caption = primero === final ? primero : `${primero} — ${final}`;

  return (
    <figure className="shrink-0">
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        width={ANCHO}
        height={ALTO}
        role="img"
        aria-label={`Evolución del patrimonio, ${caption}`}
        className="text-tinta"
      >
        {puntos.length > 1 && (
          <polyline
            points={puntos.map(([x, y]) => `${x},${y}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        <circle cx={ultimo[0]} cy={ultimo[1]} r={2.5} className="fill-verde" />
      </svg>
      <figcaption className="cifra mt-1 text-center text-[9.5px] text-tinta-terciaria">
        {caption}
      </figcaption>
    </figure>
  );
}
