import "server-only";
import { avisosParaAtender } from "@/app/(tabs)/resumen/datos";
import { movimientosCategorizados } from "@/lib/datos/movimientos";
import { obtenerPatrimonio } from "@/lib/datos/patrimonio";
import { obtenerPresupuestoMes } from "@/lib/datos/presupuesto";
import type { SesionHogar } from "@/lib/datos/sesion";
import { formatearImporte } from "@/lib/dominio/dinero";
import { formatearMesLargo, hoyBA, mesDe } from "@/lib/dominio/fechas";

// Contexto financiero del hogar para el asistente: un resumen COMPACTO en
// texto de lo que la app ya sabe (presupuesto del mes, avisos, últimos
// movimientos, patrimonio). Se inyecta como bloque de system en cada
// consulta — solo números agregados y descripciones, nunca tokens ni ids.

const MAX_MOVIMIENTOS = 15;

/** "$ 123.456" en es-AR, desde centavos. */
const $ = (centavos: number) => formatearImporte(centavos);

export async function contextoFinanciero(sesion: SesionHogar): Promise<string> {
  const hoy = hoyBA();
  const mes = mesDe(hoy);

  const [presupuestoHogar, presupuestoPersonal, avisos, ultimos, patrimonio] =
    await Promise.all([
      obtenerPresupuestoMes(sesion, mes, "hogar"),
      obtenerPresupuestoMes(sesion, mes, "personal"),
      avisosParaAtender(sesion, hoy),
      movimientosCategorizados(sesion, { limite: MAX_MOVIMIENTOS }),
      obtenerPatrimonio(sesion),
    ]);

  const partes: string[] = [
    `Fecha de hoy: ${hoy}. Mes en curso: ${formatearMesLargo(mes)}.`,
    `Usuario: ${sesion.nombreMiembro} (rol ${sesion.rol}).`,
  ];

  for (const [nombre, p] of [
    ["HOGAR", presupuestoHogar],
    ["PERSONAL", presupuestoPersonal],
  ] as const) {
    if (!p) {
      partes.push(`Presupuesto ${nombre}: sin armar este mes.`);
      continue;
    }
    partes.push(
      `Presupuesto ${nombre}: asignado ${$(p.asignadoCentavos)}, gastado ${$(p.gastadoCentavos)}, disponible ${$(p.disponibleCentavos)}.`,
    );
    const filas = p.grupos.flatMap((g) =>
      g.partidas
        .filter((pa) => pa.activa && (pa.asignadoCentavos > 0 || pa.gastadoCentavos > 0))
        .map(
          (pa) =>
            `  - ${g.grupo} / ${pa.nombre}: asignado ${$(pa.asignadoCentavos)}, gastado ${$(pa.gastadoCentavos)}${pa.fija ? " (fija)" : ""}${pa.rollover ? " (con rollover)" : ""}`,
        ),
    );
    if (filas.length > 0) partes.push(`Partidas ${nombre}:\n${filas.join("\n")}`);
  }

  if (avisos.length > 0) {
    partes.push(
      `Para atender:\n${avisos.map((a) => `  - ${a.titulo} (${a.meta})`).join("\n")}`,
    );
  }

  if (ultimos.length > 0) {
    partes.push(
      `Últimos movimientos:\n${ultimos
        .map(
          (m) =>
            `  - ${m.fecha} ${m.descripcion}: ${m.tipo === "ingreso" ? "+" : ""}${$(m.importeCentavos)}${m.categoria ? ` (${m.categoria.nombre})` : " (sin categoría)"}${m.medio ? ` con ${m.medio}` : ""}${m.esCuota && m.nCuota && m.nCuotasTotal ? ` cuota ${m.nCuota}/${m.nCuotasTotal}` : ""} [${m.visibilidad === "compartido" ? "hogar" : "personal"}]`,
        )
        .join("\n")}`,
    );
  }

  if (patrimonio.tenencias.length > 0) {
    partes.push(
      `Patrimonio total: ${$(patrimonio.totalArsCentavos)}${
        patrimonio.tcActivo
          ? ` (TC ${patrimonio.tcActivo.fuente} ${$(patrimonio.tcActivo.valorCentavos)})`
          : ""
      }\n${patrimonio.tenencias
        .map((t) => `  - ${t.nombre}: ${$(t.valorArsCentavos)} (${t.frescura})`)
        .join("\n")}`,
    );
  }

  return partes.join("\n\n");
}
