import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Zap } from "lucide-react-native";
// ⭐ Dominio COMPARTIDO con la web: la misma grilla y los mismos puntos.
import {
  DIAS_SEMANA,
  plataPorDia,
  recurrentesPorDia,
  semanasDelMes,
} from "@dominio/calendario";
import { formatearImporte } from "@dominio/dinero";
import {
  formatearDiaCorto,
  formatearDiaLargo,
  formatearMesLargo,
  formatearMesSolo,
  hoyBA,
  mesDe,
} from "@dominio/fechas";
import {
  movimientosCategorizados,
  obtenerSesionHogar,
  recurrentesActivos,
  type MovimientoFila,
  type RecurrenteActivo,
  type SesionHogar,
} from "@/lib/datos";
import {
  borrarMovimiento,
  categoriasDelHogar,
  mediosDePago,
  type CategoriaSimple,
  type MedioDePago,
} from "@/lib/acciones";
import { color, fuente, radio } from "@/lib/tema";
import { tacto } from "@/lib/tacto";
import { Card, FilaMovimiento } from "@/componentes/sistema";
import { DetalleMovimiento } from "@/componentes/DetalleMovimiento";
import { NavegadorMes } from "@/componentes/NavegadorMes";

// Calendario financiero: los días pasados cuentan lo que pasó (gastos e
// ingresos reales) y los futuros lo que viene (recurrentes con su día).
// Espeja app/calendario/ de la web: misma grilla L-a-D, mismos puntos, mismo
// detalle del día con las filas tocables de siempre. En las celdas, puntos y
// no cifras: en 44px un importe solo entra abreviado y la app no abrevia plata.
//
// Puntos: tinta = hubo gastos · verde = hubo ingresos · ámbar = vence un fijo.

export default function Calendario() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const hoy = hoyBA();
  const mesActual = mesDe(hoy);

  const [mes, setMes] = useState(mesActual);
  const [elegido, setElegido] = useState(hoy);
  const [sesion, setSesion] = useState<SesionHogar | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoFila[]>([]);
  const [recurrentes, setRecurrentes] = useState<RecurrenteActivo[]>([]);
  const [categorias, setCategorias] = useState<CategoriaSimple[]>([]);
  const [medios, setMedios] = useState<MedioDePago[]>([]);
  const [detalle, setDetalle] = useState<MovimientoFila | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    const s = await obtenerSesionHogar();
    if (!s) return;
    setSesion(s);
    const [m, r, c, md] = await Promise.all([
      movimientosCategorizados(s, { mes }),
      recurrentesActivos(s),
      categoriasDelHogar(s),
      mediosDePago(s),
    ]);
    setMovimientos(m);
    setRecurrentes(r);
    setCategorias(c);
    setMedios(md);
  }, [mes]);

  useEffect(() => {
    cargar().finally(() => setCargando(false));
  }, [cargar]);

  // al volver de editar en otra pantalla, refrescar sin spinner
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  // como en la web: al cambiar de mes, el elegido vuelve a hoy o al día 1
  function cambiarMes(nuevo: string) {
    setMes(nuevo);
    setElegido(hoy.startsWith(nuevo.slice(0, 8)) ? hoy : nuevo);
  }

  const semanas = semanasDelMes(mes);
  const plata = plataPorDia(
    movimientos.map((m) => ({
      fecha: m.fecha,
      tipo: m.tipo === "ingreso" ? ("ingreso" as const) : ("gasto" as const),
      importeCentavos: m.importeCentavos,
    })),
  );
  const fijos = recurrentesPorDia(mes, recurrentes);

  const delDia = movimientos.filter((m) => m.fecha === elegido);
  const fijosDelDia = fijos.get(elegido) ?? [];
  const esFuturo = elegido > hoy;

  return (
    <View style={e.pantalla}>
      <View style={[e.cabecera, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <ChevronLeft size={20} color={color.tinta} strokeWidth={1.5} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={e.titulo}>Calendario</Text>
          <Text style={e.bajada}>
            Lo que pasó y lo que viene en {formatearMesLargo(mes)}
          </Text>
        </View>
      </View>

      {cargando ? (
        <View style={e.centrado}>
          <ActivityIndicator color={color.verde} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 32,
          }}
        >
          <NavegadorMes mes={mes} mesActual={mesActual} alCambiar={cambiarMes} />

          {/* etiquetas L a D */}
          <View style={e.filaEtiquetas}>
            {DIAS_SEMANA.map((d, i) => (
              <Text key={i} style={e.etiquetaDia}>
                {d}
              </Text>
            ))}
          </View>

          {/* la grilla */}
          <View style={e.grilla} accessibilityLabel="Días del mes">
            {semanas.map((semana, s) => (
              <View key={s} style={e.semana}>
                {semana.map((fecha, i) => {
                  if (fecha === null) {
                    return <View key={`v-${i}`} style={e.celdaVacia} />;
                  }
                  const dia = Number(fecha.slice(8));
                  const p = plata.get(fecha);
                  const tieneFijos = fijos.has(fecha) && fecha >= hoy;
                  const esHoy = fecha === hoy;
                  const activo = fecha === elegido;
                  return (
                    <Pressable
                      key={fecha}
                      onPress={() => {
                        tacto.toque();
                        setElegido(fecha);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: activo }}
                      accessibilityLabel={`${dia} de ${formatearMesSolo(mes)}`}
                      style={[
                        e.celda,
                        esHoy && e.celdaHoy,
                        activo && e.celdaActiva,
                      ]}
                    >
                      <Text
                        style={[
                          e.numero,
                          fecha > hoy && { color: color.tintaSecundaria },
                          esHoy && e.numeroHoy,
                        ]}
                      >
                        {dia}
                      </Text>
                      <View style={e.puntos}>
                        {p && p.gastosCentavos > 0 && (
                          <View style={[e.punto, { backgroundColor: color.tintaSecundaria }]} />
                        )}
                        {p && p.ingresosCentavos > 0 && (
                          <View style={[e.punto, { backgroundColor: color.verde }]} />
                        )}
                        {tieneFijos && (
                          <View style={[e.punto, { backgroundColor: color.ambar }]} />
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          {/* leyenda */}
          <View style={e.leyenda}>
            <View style={e.leyendaItem}>
              <View style={[e.punto, { backgroundColor: color.tintaSecundaria }]} />
              <Text style={e.leyendaTexto}>gastos</Text>
            </View>
            <View style={e.leyendaItem}>
              <View style={[e.punto, { backgroundColor: color.verde }]} />
              <Text style={e.leyendaTexto}>ingresos</Text>
            </View>
            <View style={e.leyendaItem}>
              <View style={[e.punto, { backgroundColor: color.ambar }]} />
              <Text style={e.leyendaTexto}>fijo por vencer</Text>
            </View>
          </View>

          {/* el día elegido */}
          <Text style={e.tituloDia}>{formatearDiaLargo(elegido)}</Text>

          {/* los fijos que vencen ese día (solo mirando adelante) */}
          {fijosDelDia.length > 0 && esFuturo && (
            <Card style={{ marginBottom: 10 }}>
              {fijosDelDia.map((r, i) => (
                <View key={r.id} style={[e.filaFijo, i > 0 && e.conBorde]}>
                  <Zap size={18} color={color.ambar} strokeWidth={1.5} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={e.fijoDescripcion}>
                      {r.descripcion}
                    </Text>
                    <Text style={e.fijoMeta}>
                      {formatearImporte(r.importeSugeridoCentavos)} sugerido
                      {r.categoria ? ` · ${r.categoria}` : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          )}

          {delDia.length > 0 ? (
            <Card>
              {delDia.map((m, i) => (
                <Pressable
                  key={m.id}
                  onPress={() => setDetalle(m)}
                  style={i > 0 ? e.conBorde : undefined}
                >
                  <FilaMovimiento
                    descripcion={m.descripcion}
                    icono={m.icono}
                    metadata={[m.categoria, m.medio].filter(Boolean).join(" · ")}
                    cierreCiclo={
                      m.cierreCiclo
                        ? `cierra ${formatearDiaCorto(m.cierreCiclo.fechaCierre)}`
                        : undefined
                    }
                    importeCentavos={m.importeCentavos}
                    esIngreso={m.esIngreso}
                    ambito={m.ambito}
                    badgeCuota={m.badgeCuota}
                  />
                </Pressable>
              ))}
            </Card>
          ) : (
            (fijosDelDia.length === 0 || !esFuturo) && (
              <Card style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
                <Text style={e.vacio}>
                  {esFuturo ? "Nada agendado para ese día" : "Sin movimientos ese día"}
                </Text>
              </Card>
            )
          )}
        </ScrollView>
      )}

      <DetalleMovimiento
        movimiento={detalle}
        sesion={sesion}
        categorias={categorias}
        medios={medios}
        alCambiar={cargar}
        alCerrar={() => setDetalle(null)}
        alBorrar={async () => {
          const id = detalle?.id;
          setDetalle(null);
          if (!id || !sesion) return;
          const r = await borrarMovimiento(sesion, id);
          if (!r.ok) Alert.alert("No pudimos borrarlo", r.error);
          else await cargar();
        }}
      />
    </View>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.papel },
  centrado: { flex: 1, alignItems: "center", justifyContent: "center" },
  cabecera: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  titulo: { fontSize: 17, fontFamily: fuente.textoSemi, color: color.tinta },
  bajada: {
    marginTop: 2,
    fontSize: 12.5,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
  filaEtiquetas: { marginTop: 18, flexDirection: "row", gap: 4 },
  etiquetaDia: {
    flex: 1,
    textAlign: "center",
    fontSize: 10.5,
    fontFamily: fuente.textoMedio,
    color: color.tintaTerciaria,
  },
  grilla: { marginTop: 6, gap: 4 },
  semana: { flexDirection: "row", gap: 4 },
  celdaVacia: { flex: 1, aspectRatio: 1 },
  celda: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radio.chip,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: color.superficie,
  },
  // border-verde/50 de la web: el verde de marca a media opacidad
  celdaHoy: { borderColor: "#4fa37f80" },
  celdaActiva: { borderColor: color.verde, backgroundColor: color.verdeSuave },
  numero: {
    fontSize: 13,
    fontFamily: fuente.mono,
    fontVariant: ["tabular-nums"],
    color: color.tinta,
  },
  numeroHoy: { fontFamily: fuente.monoSemi, color: color.verde },
  puntos: {
    marginTop: 2,
    height: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  punto: { width: 6, height: 6, borderRadius: 3 },
  leyenda: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  leyendaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  leyendaTexto: {
    fontSize: 10.5,
    fontFamily: fuente.texto,
    color: color.tintaTerciaria,
  },
  tituloDia: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: 13,
    fontFamily: fuente.textoSemi,
    color: color.tinta,
  },
  filaFijo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fijoDescripcion: {
    fontSize: 13.5,
    fontFamily: fuente.textoMedio,
    color: color.tinta,
  },
  fijoMeta: {
    marginTop: 3,
    fontSize: 11,
    fontFamily: fuente.mono,
    fontVariant: ["tabular-nums"],
    color: color.tintaSecundaria,
  },
  vacio: { fontSize: 13, fontFamily: fuente.texto, color: color.tintaSecundaria },
  conBorde: { borderTopWidth: 1, borderTopColor: color.separador },
});
