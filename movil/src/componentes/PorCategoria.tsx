import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { ChartPie } from "lucide-react-native";
import { formatearImporte } from "@dominio/dinero";
import { arcos, repartir, type ItemReparto, type Porcion } from "@dominio/reparto";
import { color, radio } from "@/lib/tema";
import { Card, EstadoVacio, IconoCategoria } from "@/componentes/sistema";

// Vista "Por categoría": el anillo arriba y el mismo dato en lista abajo.
// Espeja components/sistema/{Dona,PorCategoria}.tsx de la web, con el mismo
// dominio (repartir/arcos) para que los porcentajes y los arcos sean idénticos.
//
// La rampa va del verde de marca a un gris neutro. NO usa rojo ni ámbar a
// propósito: en esta app significan "excedido" y "atención", y una categoría no
// está en problemas por ser la más grande del mes.

const RAMPA = ["#4fa37f", "#6cab8d", "#87b39c", "#a0b6a8", "#aba8a0", "#938d84", "#6b665e"];

const TAMANO = 168;
const GROSOR = 22;
const RADIO = (TAMANO - GROSOR) / 2;
const CENTRO = TAMANO / 2;
const HUECO_GRADOS = 1.4;

function tono(indice: number): string {
  return RAMPA[Math.min(indice, RAMPA.length - 1)];
}

/** Punto del borde del anillo para un ángulo en grados, 0 = las 12 en punto. */
function punto(grados: number): [number, number] {
  const rad = ((grados - 90) * Math.PI) / 180;
  return [CENTRO + RADIO * Math.cos(rad), CENTRO + RADIO * Math.sin(rad)];
}

function arco(desde: number, hasta: number): string {
  const barrido = hasta - desde;
  // un arco de 360° con el mismo inicio y fin no dibuja nada: se parte en dos
  if (barrido >= 359.9) {
    const [x1, y1] = punto(0);
    const [x2, y2] = punto(180);
    return `M ${x1} ${y1} A ${RADIO} ${RADIO} 0 1 1 ${x2} ${y2} A ${RADIO} ${RADIO} 0 1 1 ${x1} ${y1}`;
  }
  const [x1, y1] = punto(desde);
  const [x2, y2] = punto(hasta);
  return `M ${x1} ${y1} A ${RADIO} ${RADIO} 0 ${barrido > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}

function Dona({ porciones, totalCentavos }: { porciones: Porcion[]; totalCentavos: number }) {
  const tramos = arcos(porciones);
  return (
    <View style={e.dona}>
      <Svg width={TAMANO} height={TAMANO}>
        {/* la pista de atrás: con una sola porción igual se ve un anillo */}
        <Circle
          cx={CENTRO}
          cy={CENTRO}
          r={RADIO}
          fill="none"
          stroke={color.pista}
          strokeWidth={GROSOR}
        />
        {tramos.map((t, i) => {
          // el hueco se le saca al final y solo si la porción da: una de 1°
          // no puede perder 1,4° o desaparece
          const hueco = t.hasta - t.desde > HUECO_GRADOS * 2 ? HUECO_GRADOS : 0;
          return (
            <Path
              key={porciones[i].clave}
              d={arco(t.desde, t.hasta - hueco)}
              fill="none"
              stroke={tono(porciones[i].indice)}
              strokeWidth={GROSOR}
            />
          );
        })}
      </Svg>
      <View style={e.centroDona} pointerEvents="none">
        <Text style={e.centroEtiqueta}>Gastado</Text>
        <Text style={e.centroCifra}>{formatearImporte(totalCentavos)}</Text>
      </View>
    </View>
  );
}

export function PorCategoria({
  items,
  vacio,
  totalGastosCentavos,
}: {
  items: ItemReparto[];
  vacio: string;
  totalGastosCentavos?: number;
}) {
  const porciones = repartir(items);
  const total = porciones.reduce((s, p) => s + p.centavos, 0);
  // lo gastado sin clasificar no puede entrar en un reparto POR categoría,
  // pero tampoco puede desaparecer sin que el usuario sepa por qué
  const sinCategorizar = Math.max(0, (totalGastosCentavos ?? total) - total);

  if (porciones.length === 0) {
    return (
      <View style={{ marginTop: 40 }}>
        <EstadoVacio Icono={ChartPie} titulo="Todavía no hay gastos" cuerpo={vacio} />
      </View>
    );
  }

  return (
    <View style={{ marginTop: 18 }}>
      <Dona porciones={porciones} totalCentavos={total} />

      {sinCategorizar > 0 && (
        <Text style={e.nota}>
          No entran {formatearImporte(sinCategorizar)} sin categorizar: elegiles
          categoría y aparecen acá.
        </Text>
      )}

      <Card>
        {porciones.map((p, i) => (
          <View key={p.clave} style={[e.fila, i > 0 && e.conBorde]}>
            <View style={[e.punto, { backgroundColor: tono(p.indice) }]} />
            {/* "Otras" no es una categoría, es una bolsa: no lleva ícono */}
            {!p.esOtras && <IconoCategoria nombre={p.icono} tamano={17} />}
            <Text numberOfLines={1} style={e.nombre}>
              {p.nombre}
            </Text>
            <Text style={e.importe}>{formatearImporte(p.centavos)}</Text>
            <Text style={e.porcentaje}>{p.porcentaje} %</Text>
          </View>
        ))}
      </Card>
    </View>
  );
}

const e = StyleSheet.create({
  dona: { alignItems: "center", justifyContent: "center" },
  centroDona: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  centroEtiqueta: { fontSize: 10.5, color: color.tintaSecundaria },
  centroCifra: { fontSize: 17, fontWeight: "600", color: color.tinta },
  nota: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 11.5,
    lineHeight: 18,
    color: color.tintaTerciaria,
  },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  conBorde: { borderTopWidth: 1, borderTopColor: color.separador },
  punto: { width: 10, height: 10, borderRadius: 5 },
  nombre: { flex: 1, fontSize: 14, color: color.tinta },
  importe: { fontSize: 13.5, fontWeight: "600", color: color.tinta },
  porcentaje: { width: 36, textAlign: "right", fontSize: 12, color: color.tintaSecundaria },
});
