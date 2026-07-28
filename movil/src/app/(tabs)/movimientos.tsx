import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Inbox } from "lucide-react-native";
import { etiquetaDia, hoyBA } from "@dominio/fechas";
import {
  bandejaDeEntrada,
  movimientosCategorizados,
  obtenerSesionHogar,
  type MovimientoFila,
  type SesionHogar,
} from "@/lib/datos";
import {
  categoriasDelHogar,
  categorizarMovimiento,
  type CategoriaSimple,
} from "@/lib/acciones";
import { color, radio } from "@/lib/tema";
import {
  Card,
  EstadoVacio,
  FilaMovimiento,
  IconoCategoria,
  Importe,
} from "@/componentes/sistema";

// 05 — Movimientos: bandeja de entrada (lo que llegó sin categoría) arriba, y
// abajo el historial agrupado por día. La bandeja lleva el borde cálido, único
// en el sistema (§3.8).

/** Agrupa el historial por fecha, conservando el orden. */
function porDia(movimientos: MovimientoFila[], hoy: string) {
  const grupos: Array<{ etiqueta: string; items: MovimientoFila[] }> = [];
  for (const m of movimientos) {
    const etiqueta = etiquetaDia(m.fecha, hoy);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.etiqueta === etiqueta) ultimo.items.push(m);
    else grupos.push({ etiqueta, items: [m] });
  }
  return grupos;
}

export default function Movimientos() {
  const insets = useSafeAreaInsets();
  const [sesion, setSesion] = useState<SesionHogar | null>(null);
  const [bandeja, setBandeja] = useState<MovimientoFila[]>([]);
  const [historial, setHistorial] = useState<MovimientoFila[]>([]);
  const [categorias, setCategorias] = useState<CategoriaSimple[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  // categorización inline: qué ítem está abierto y cuáles ya se ocultaron
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [ocultos, setOcultos] = useState<string[]>([]);

  const hoy = hoyBA();

  const cargar = useCallback(async () => {
    const s = await obtenerSesionHogar();
    if (!s) return;
    setSesion(s);
    const [b, h, c] = await Promise.all([
      bandejaDeEntrada(s),
      movimientosCategorizados(s, 40),
      categoriasDelHogar(s),
    ]);
    setBandeja(b);
    setHistorial(h);
    setCategorias(c);
    setOcultos([]);
  }, []);

  useEffect(() => {
    cargar().finally(() => setCargando(false));
  }, [cargar]);

  // al volver de cargar un gasto, refrescar sin spinner de pantalla completa
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function refrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  /** Optimista: la fila sale de la bandeja al instante y luego se reconcilia. */
  async function categorizar(movimientoId: string, categoriaId: string) {
    if (!sesion) return;
    setOcultos((prev) => [...prev, movimientoId]);
    setAbiertoId(null);
    const r = await categorizarMovimiento(sesion, movimientoId, categoriaId);
    if (!r.ok) setOcultos((prev) => prev.filter((id) => id !== movimientoId));
    else await cargar();
  }

  if (cargando) {
    return (
      <View style={e.centrado}>
        <ActivityIndicator color={color.verde} />
      </View>
    );
  }

  const visiblesBandeja = bandeja.filter((m) => !ocultos.includes(m.id));
  const grupos = porDia(historial, hoy);

  return (
    <ScrollView
      style={e.pantalla}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingHorizontal: 20,
        paddingBottom: insets.bottom + 24,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refrescando}
          onRefresh={refrescar}
          tintColor={color.tintaSecundaria}
        />
      }
    >
      <Text style={e.titulo}>Movimientos</Text>

      {/* Bandeja de entrada: borde cálido + contador ámbar. Tocar un ítem
          despliega las categorías; al asignar, pasa al historial. */}
      {visiblesBandeja.length > 0 && (
        <View style={e.bandeja}>
          <View style={e.bandejaEncabezado}>
            <Inbox size={15} color={color.ambar} strokeWidth={1.5} />
            <Text style={e.bandejaTitulo}>Bandeja de entrada</Text>
            <View style={e.contador}>
              <Text style={e.contadorTexto}>{visiblesBandeja.length}</Text>
            </View>
          </View>
          {visiblesBandeja.map((m, i) => {
            const abierto = abiertoId === m.id;
            const delAmbito = categorias.filter((c) => c.ambito === m.ambito);
            return (
              <View key={m.id} style={i > 0 ? e.conBorde : undefined}>
                <Pressable
                  onPress={() => setAbiertoId(abierto ? null : m.id)}
                  style={e.bandejaFila}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={e.bandejaDescripcion}>
                      {m.descripcion}
                    </Text>
                    <Text numberOfLines={1} style={e.bandejaMeta}>
                      {[etiquetaDia(m.fecha, hoy).toLowerCase(), m.medio]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                  <Importe
                    centavos={m.importeCentavos}
                    variante="fila"
                    conSigno={m.esIngreso}
                    color={m.esIngreso ? color.verde : color.tinta}
                  />
                </Pressable>

                {abierto && (
                  <View style={e.chipsCategoria}>
                    {delAmbito.map((c) => (
                      <Pressable
                        key={c.id}
                        onPress={() => categorizar(m.id, c.id)}
                        style={e.chipCategoria}
                      >
                        <IconoCategoria nombre={c.icono} tamano={13} />
                        <Text style={e.chipCategoriaTexto}>{c.nombre}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Historial agrupado por día */}
      {grupos.length === 0 ? (
        <View style={{ marginTop: 48 }}>
          <EstadoVacio
            Icono={Inbox}
            titulo="Todavía no hay movimientos"
            cuerpo="Cargá tu primer gasto con el botón + y va a aparecer acá."
          />
        </View>
      ) : (
        grupos.map((g) => (
          <View key={g.etiqueta}>
            <Text style={e.dia}>{g.etiqueta}</Text>
            <Card>
              {g.items.map((m, i) => (
                <View key={m.id} style={i > 0 ? e.conBorde : undefined}>
                  <FilaMovimiento
                    descripcion={m.descripcion}
                    icono={m.icono}
                    metadata={[m.categoria, m.medio].filter(Boolean).join(" · ")}
                    importeCentavos={m.importeCentavos}
                    esIngreso={m.esIngreso}
                    ambito={m.ambito}
                    badgeCuota={m.badgeCuota}
                  />
                </View>
              ))}
            </Card>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.papel },
  centrado: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.papel,
  },
  titulo: { fontSize: 22, fontWeight: "600", color: color.tinta },
  bandeja: {
    marginTop: 16,
    borderRadius: radio.card,
    borderWidth: 1,
    borderColor: color.bordeBandeja,
    backgroundColor: color.superficie,
    overflow: "hidden",
  },
  bandejaEncabezado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  bandejaTitulo: { flex: 1, fontSize: 13.5, fontWeight: "600", color: color.tinta },
  contador: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.ambar,
  },
  contadorTexto: { fontSize: 11, fontWeight: "600", color: color.blanco },
  bandejaFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  bandejaDescripcion: { fontSize: 14, fontWeight: "500", color: color.tinta },
  bandejaMeta: { marginTop: 2, fontSize: 11, color: color.tintaSecundaria },
  chipsCategoria: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  chipCategoria: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: radio.chipMini,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  chipCategoriaTexto: { fontSize: 11.5, fontWeight: "500", color: color.tintaSecundaria },
  dia: {
    marginTop: 20,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "600",
    color: color.tintaSecundaria,
  },
  conBorde: { borderTopWidth: 1, borderTopColor: color.separador },
});
