import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { ChartPie, ChevronDown, ChevronUp } from "lucide-react-native";
import { formatearImporte } from "@dominio/dinero";
import { arcos, repartir, type ItemReparto, type Porcion } from "@dominio/reparto";
import { color, radio } from "@/lib/tema";
import { tacto } from "@/lib/tacto";
import { Card, EstadoVacio, IconoCategoria } from "@/componentes/sistema";

// Vista "Por categoría": el anillo arriba y el mismo dato en lista abajo.
// Espeja components/sistema/{Dona,PorCategoria}.tsx de la web, con el mismo
// dominio (repartir/arcos) para que los porcentajes y los arcos sean idénticos.
//
// La rampa va del verde de marca a un gris neutro. NO usa rojo ni ámbar a
// propósito: en esta app significan "excedido" y "atención", y una categoría no
// está en problemas por ser la más grande del mes.
//
// La fila "Otras" se puede desplegar: la bolsa puede ser la segunda porción más
// grande del mes, y una fila muerta que dice "un quinto de tu plata, no te digo
// en qué" contradice a toda la vista. Al tocarla se abren DEBAJO las categorías
// que esconde; el anillo no cambia (sigue mostrando la porción agregada).

const RAMPA = ["#4fa37f", "#6cab8d", "#87b39c", "#a0b6a8", "#aba8a0", "#938d84", "#6b665e"];

const TAMANO = 200;
const GROSOR = 25;
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

/**
 * Las categorías que "Otras" esconde, en el mismo orden del reparto (monto
 * desc, después nombre) y con los puntos de porcentaje de "Otras" repartidos
 * por el método del resto mayor: si la fila madre dice 19 %, las hijas tienen
 * que sumar 19 exacto o el desglose se lee como un error de la app.
 */
function desplegarOtras(
  items: ItemReparto[],
  porciones: Porcion[],
  puntosDeOtras: number,
): Array<ItemReparto & { porcentaje: number }> {
  const visibles = new Set(porciones.filter((p) => !p.esOtras).map((p) => p.clave));
  const escondidas = items
    .filter((i) => i.centavos > 0 && !visibles.has(i.clave))
    .sort((a, b) => b.centavos - a.centavos || a.nombre.localeCompare(b.nombre, "es"));

  const total = escondidas.reduce((s, i) => s + i.centavos, 0);
  if (total === 0) return [];

  const exactos = escondidas.map((i) => (i.centavos * puntosDeOtras) / total);
  const base = exactos.map(Math.floor);
  let restantes = puntosDeOtras - base.reduce((s, n) => s + n, 0);
  const porFraccion = exactos
    .map((valor, i) => ({ i, fraccion: valor - Math.floor(valor) }))
    .sort((a, b) => b.fraccion - a.fraccion);
  for (const { i } of porFraccion) {
    if (restantes <= 0) break;
    base[i] += 1;
    restantes -= 1;
  }

  // ninguna sub-fila con plata queda en 0 % mientras la mayor pueda ceder
  const mayor = base.indexOf(Math.max(...base));
  for (let i = 0; i < base.length; i++) {
    if (base[i] === 0 && base[mayor] > 1) {
      base[i] = 1;
      base[mayor] -= 1;
    }
  }

  return escondidas.map((item, i) => ({ ...item, porcentaje: base[i] }));
}

function Dona({
  porciones,
  totalCentavos,
  etiqueta,
}: {
  porciones: Porcion[];
  totalCentavos: number;
  etiqueta: string;
}) {
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
        <Text style={e.centroEtiqueta}>{etiqueta}</Text>
        <Text style={e.centroCifra}>{formatearImporte(totalCentavos)}</Text>
      </View>
    </View>
  );
}

export function PorCategoria({
  items,
  vacio,
  tituloVacio = "Todavía no hay gastos",
  etiquetaTotal = "Gastado",
  totalGastosCentavos,
}: {
  items: ItemReparto[];
  vacio: string;
  tituloVacio?: string;
  /** "Gastado" en Movimientos, "Asignado" en Presupuesto */
  etiquetaTotal?: string;
  totalGastosCentavos?: number;
}) {
  // arranca colapsada: el desglose es para quien pregunta, no para todos
  const [otrasAbierta, setOtrasAbierta] = useState(false);

  const porciones = repartir(items);
  const total = porciones.reduce((s, p) => s + p.centavos, 0);
  // lo gastado sin clasificar no puede entrar en un reparto POR categoría,
  // pero tampoco puede desaparecer sin que el usuario sepa por qué
  const sinCategorizar = Math.max(0, (totalGastosCentavos ?? total) - total);

  const otras = porciones.find((p) => p.esOtras);
  const dentroDeOtras = otras ? desplegarOtras(items, porciones, otras.porcentaje) : [];

  if (porciones.length === 0) {
    return (
      <View style={{ marginTop: 40 }}>
        <EstadoVacio Icono={ChartPie} titulo={tituloVacio} cuerpo={vacio} />
      </View>
    );
  }

  return (
    <View style={{ marginTop: 18 }}>
      <Dona porciones={porciones} totalCentavos={total} etiqueta={etiquetaTotal} />

      {sinCategorizar > 0 && (
        <Text style={e.nota}>
          No entran {formatearImporte(sinCategorizar)} sin categorizar: elegiles
          categoría y aparecen acá.
        </Text>
      )}

      <Card>
        {porciones.map((p, i) =>
          p.esOtras ? (
            <View key={p.clave}>
              {/* "Otras" no es una categoría, es una bolsa: no lleva ícono,
                  pero sí se abre para mostrar lo que tiene adentro */}
              <Pressable
                onPress={() => {
                  tacto.toque();
                  setOtrasAbierta((v) => !v);
                }}
                accessibilityRole="button"
                accessibilityState={{ expanded: otrasAbierta }}
                style={[e.fila, i > 0 && e.conBorde]}
              >
                <View style={[e.punto, { backgroundColor: tono(p.indice) }]} />
                <View style={e.nombreConChevron}>
                  <Text numberOfLines={1} style={e.nombreOtras}>
                    {p.nombre}
                  </Text>
                  {otrasAbierta ? (
                    <ChevronUp size={14} color={color.tintaTerciaria} strokeWidth={2} />
                  ) : (
                    <ChevronDown size={14} color={color.tintaTerciaria} strokeWidth={2} />
                  )}
                </View>
                <Text style={e.importe}>{formatearImporte(p.centavos)}</Text>
                <Text style={e.porcentaje}>{p.porcentaje} %</Text>
              </Pressable>
              {otrasAbierta &&
                dentroDeOtras.map((s) => (
                  <View key={s.clave} style={e.subFila}>
                    {/* el neutro de "Otras", no un color propio: el anillo no
                        tiene un tramo para esta categoría */}
                    <View style={[e.subPunto, { backgroundColor: tono(p.indice) }]} />
                    <Text numberOfLines={1} style={e.subNombre}>
                      {s.nombre}
                    </Text>
                    <Text style={e.subImporte}>{formatearImporte(s.centavos)}</Text>
                    <Text style={e.subPorcentaje}>{s.porcentaje} %</Text>
                  </View>
                ))}
            </View>
          ) : (
            <View key={p.clave} style={[e.fila, i > 0 && e.conBorde]}>
              <View style={[e.punto, { backgroundColor: tono(p.indice) }]} />
              <IconoCategoria nombre={p.icono} tamano={17} />
              <Text numberOfLines={1} style={e.nombre}>
                {p.nombre}
              </Text>
              <Text style={e.importe}>{formatearImporte(p.centavos)}</Text>
              <Text style={e.porcentaje}>{p.porcentaje} %</Text>
            </View>
          ),
        )}
      </Card>
    </View>
  );
}

const e = StyleSheet.create({
  dona: { alignItems: "center", justifyContent: "center", marginBottom: 22 },
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
  centroCifra: { fontSize: 19, fontWeight: "600", color: color.tinta },
  nota: {
    marginTop: -8,
    marginBottom: 14,
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
  nombreConChevron: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  nombreOtras: { flexShrink: 1, fontSize: 14, color: color.tinta },
  importe: { fontSize: 13.5, fontWeight: "600", color: color.tinta },
  porcentaje: { width: 36, textAlign: "right", fontSize: 12, color: color.tintaSecundaria },
  // las sub-filas de "Otras": misma anatomía, un toque más chicas e indentadas
  // para que se lean como el contenido de la bolsa y no como porciones nuevas
  subFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 36,
    paddingRight: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: color.separador,
  },
  subPunto: { width: 6, height: 6, borderRadius: 3 },
  subNombre: { flex: 1, fontSize: 13, color: color.tintaSecundaria },
  subImporte: { fontSize: 12.5, fontWeight: "600", color: color.tinta },
  subPorcentaje: { width: 36, textAlign: "right", fontSize: 11, color: color.tintaTerciaria },
});
