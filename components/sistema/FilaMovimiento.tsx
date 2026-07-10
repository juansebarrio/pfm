import { ArrowDownLeft } from "lucide-react";
import { Badge } from "./Badge";
import { IconoCategoria } from "./IconoCategoria";
import { Importe } from "./Importe";

// Fila de movimiento (04/05/06). Ícono de categoría + descripción + metadata
// "Categoría · Medio · cierra N jul" + importe mono (verde con "+" si es ingreso)
// + badge de ámbito. La metadata de cierre va en ámbar (va a un ciclo).

export type DatosFilaMovimiento = {
  descripcion: string;
  icono?: string;
  /** "Supermercado · Visa •• 4321" */
  metadata: string;
  /** "cierra 28 jul" — pintado ámbar */
  metadataCiclo?: string;
  importeCentavos: number;
  esIngreso?: boolean;
  ambito?: "hogar" | "personal";
  /** CUOTA 5/12 */
  badgeCuota?: string;
};

export function FilaMovimiento(m: DatosFilaMovimiento) {
  return (
    <div className="flex items-center gap-[11px] px-3.5 py-[10px]">
      {m.esIngreso ? (
        <ArrowDownLeft className="size-[18px] text-verde" strokeWidth={1.5} aria-hidden />
      ) : (
        <IconoCategoria nombre={m.icono ?? "tag"} />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-tinta">
          {m.descripcion}
          {m.badgeCuota && (
            <span className="ml-1.5 align-[2px]">
              <Badge variante="cuota">{m.badgeCuota}</Badge>
            </span>
          )}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-tinta-secundaria">
          {m.metadata}
          {m.metadataCiclo && (
            <span className="text-ambar-texto"> · {m.metadataCiclo}</span>
          )}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Importe
          centavos={m.importeCentavos}
          variante="fila"
          conSigno={m.esIngreso}
          className={m.esIngreso ? "text-verde" : "text-tinta"}
        />
        {m.ambito && <Badge variante={m.ambito}>{m.ambito}</Badge>}
      </div>
    </div>
  );
}
