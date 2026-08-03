import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { LineChart } from "lucide-react-native";
import { arsAUsd, formatearImporte, formatearPorcentaje } from "@dominio/dinero";
import { etiquetaDia, formatearDiaCorto, hoyBA } from "@dominio/fechas";
import {
  obtenerPatrimonio,
  obtenerSesionHogar,
  type Patrimonio as DatosPatrimonio,
  type SesionHogar,
} from "@/lib/datos";
import {
  etiquetaFuente,
  obtenerTenenciaEditable,
  type TenenciaEditable,
} from "@/lib/acciones-patrimonio";
import { AIRE_PASTILLA, color, fuente } from "@/lib/tema";
import { Card, EncabezadoSeccion, EstadoVacio, Importe } from "@/componentes/sistema";
import { AgregarTenencia } from "@/componentes/AgregarTenencia";
import { RevaluarTenencia } from "@/componentes/RevaluarTenencia";

// 08 — Patrimonio: total del hogar, composición y tenencias con su frescura.
// El hero redondea a la centena de mil con ≈ (DESIGN_NOTES §1.2); el detalle
// exacto vive en las filas. Las barras se normalizan al MÁXIMO, no al 100 %
// (regla del export §3.28). Tocar una tenencia abre la hoja de revaluación —
// la valuación vieja tiene salida, no es solo alarma — y el pie de la card
// abre el alta (patrón §3.14 de ListaTenencias).

// Misma aritmética que el hero web (app/(tabs)/patrimonio/page.tsx).
const CENTENA_DE_MIL = 10_000_000; // $ 100.000 en centavos
const CENTENA_USD = 10_000; // USD 100 en centavos

/** "hoy 10 jul" / "ayer 9 jul" / "8 jul" — espeja etiquetaFechaTC de app/(tabs)/patrimonio/page.tsx. */
function etiquetaFechaTC(fecha: string, hoy: string): string {
  const corto = formatearDiaCorto(fecha);
  const relativa = etiquetaDia(fecha, hoy).toLowerCase();
  return relativa === corto ? corto : `${relativa} ${corto}`;
}

export default function Patrimonio() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [sesion, setSesion] = useState<SesionHogar | null>(null);
  const [datos, setDatos] = useState<DatosPatrimonio | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [revaluar, setRevaluar] = useState<TenenciaEditable | null>(null);
  const [alta, setAlta] = useState(false);
  const [abriendo, setAbriendo] = useState(false);

  const cargar = useCallback(async () => {
    const s = await obtenerSesionHogar();
    if (!s) return;
    setSesion(s);
    setDatos(await obtenerPatrimonio(s));
  }, []);

  useEffect(() => {
    cargar().finally(() => setCargando(false));
  }, [cargar]);

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

  // refetch al cerrar cada hoja: lo guardado se ve al instante
  function cerrarHojas() {
    setRevaluar(null);
    setAlta(false);
    cargar();
  }

  // la fila valuada no trae la cantidad/valuación cruda: se busca al tocar
  async function abrirRevaluacion(tenenciaId: string) {
    if (!sesion || abriendo) return;
    setAbriendo(true);
    const tenencia = await obtenerTenenciaEditable(sesion, tenenciaId);
    setAbriendo(false);
    if (!tenencia) {
      Alert.alert("No pudimos abrir la tenencia", "Probá de nuevo.");
      return;
    }
    setRevaluar(tenencia);
  }

  if (cargando) {
    return (
      <View style={e.centrado}>
        <ActivityIndicator color={color.verde} />
      </View>
    );
  }

  // 08b — sin tenencias: estado vacío CON salida, como VacioPatrimonio web
  if (!datos || datos.tenencias.length === 0) {
    return (
      <View style={e.centrado}>
        <EstadoVacio
          Icono={LineChart}
          titulo="Todavía no cargaste tenencias"
          cuerpo="Sumá tus dólares, plazos fijos o inversiones y mirá cómo evoluciona tu patrimonio."
          accion={{ texto: "Cargar tenencia", onPress: () => setAlta(true) }}
        />
        <AgregarTenencia
          abierta={alta}
          sesion={sesion}
          tcFuente={datos?.tcFuente ?? null}
          tcValorCentavos={datos?.tcValorCentavos ?? null}
          alCerrar={cerrarHojas}
        />
      </View>
    );
  }

  const total = datos.totalArsCentavos;
  const totalRedondeado = Math.round(total / CENTENA_DE_MIL) * CENTENA_DE_MIL;
  const usdRedondeado =
    datos.tcValorCentavos !== null
      ? Math.round(arsAUsd(total, datos.tcValorCentavos) / CENTENA_USD) * CENTENA_USD
      : null;

  return (
    <ScrollView
      style={e.pantalla}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingHorizontal: 20,
        paddingBottom: insets.bottom + AIRE_PASTILLA,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refrescando}
          onRefresh={refrescar}
          tintColor={color.tintaSecundaria}
        />
      }
    >
      {/* Título + avatar del hogar. La entrada a /hogar vivía solo en Resumen:
          en las otras tres tabs desaparecía, y volver atrás para cambiar de
          pantalla es el tipo de cosa que se aprende mal una vez y molesta
          siempre. Misma anatomía que resumen.tsx (34px, inicial, → /hogar). */}
      <View style={e.encabezado}>
        <Text style={e.titulo}>Patrimonio</Text>
        <Pressable onPress={() => router.push("/hogar")} hitSlop={8} style={e.avatar}>
          <Text style={e.avatarTexto}>
            {(sesion?.nombreMiembro ?? "?").charAt(0).toUpperCase()}
          </Text>
        </Pressable>
      </View>

      {/* Total del hogar redondeado (≈, §1.2) + equivalente USD + TC con fecha */}
      <Card style={{ marginTop: 16, paddingHorizontal: 14, paddingVertical: 14 }}>
        <Text style={e.etiqueta}>Total del hogar</Text>
        <View style={e.filaTotal}>
          {totalRedondeado !== total && <Text style={e.aprox}>≈</Text>}
          <Importe centavos={totalRedondeado} variante="patrimonio" />
        </View>
        {usdRedondeado !== null && (
          <Text style={e.usd}>≈ {formatearImporte(usdRedondeado, "USD")}</Text>
        )}
        {datos.tcFuente !== null && datos.tcValorCentavos !== null && (
          <Text style={e.tc}>
            {etiquetaFuente(datos.tcFuente)} {formatearImporte(datos.tcValorCentavos)}
            {datos.tcFecha !== null && ` · ${etiquetaFechaTC(datos.tcFecha, hoyBA())}`}
          </Text>
        )}
      </Card>

      {/* Composición: fila única nombre + barra en TINTA + % en mono, como la
          web — la barra es magnitud, no estado: el verde acá mentiría */}
      <EncabezadoSeccion>Composición</EncabezadoSeccion>
      <Card style={{ paddingHorizontal: 14, paddingVertical: 14, gap: 10 }}>
        {datos.tenencias.map((t) => (
          <View key={`comp-${t.id}`} style={e.compFila}>
            <Text numberOfLines={1} style={e.compNombre}>
              {t.nombre}
            </Text>
            <View style={e.compPista}>
              <View
                style={{
                  height: "100%",
                  borderRadius: 3,
                  backgroundColor: color.tinta,
                  width: `${t.fraccionDelMaximo * 100}%`,
                }}
              />
            </View>
            <Text style={e.compPorcentaje}>{formatearPorcentaje(t.porcentaje)}</Text>
          </View>
        ))}
      </Card>

      {/* Tenencias con su frescura; tocar una abre la revaluación. La vieja va
          en ámbar y su "· actualizar" en VERDE: es acción, no alarma */}
      <EncabezadoSeccion>Tenencias</EncabezadoSeccion>
      <Card>
        {datos.tenencias.map((t, i) => (
          <Pressable
            key={t.id}
            onPress={() => abrirRevaluacion(t.id)}
            style={[e.tenencia, i > 0 && e.conBorde]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={e.tenenciaNombre}>
                {t.nombre}
              </Text>
              <Text
                numberOfLines={1}
                style={[e.tenenciaMeta, t.vieja && { color: color.ambarTexto }]}
              >
                {[t.detalle, t.frescura].filter(Boolean).join(" · ")}
                {t.vieja && <Text style={e.actualizar}> · actualizar</Text>}
              </Text>
            </View>
            <Importe
              centavos={t.valorArsCentavos}
              variante="filaChica"
              color={t.vieja ? color.ambarTexto : color.tinta}
            />
          </Pressable>
        ))}
        <Pressable onPress={() => setAlta(true)} style={e.pieAgregar}>
          <Text style={e.pieAgregarTexto}>Agregar tenencia →</Text>
        </Pressable>
      </Card>

      <RevaluarTenencia
        tenencia={revaluar}
        sesion={sesion}
        tcFuente={datos.tcFuente}
        tcValorCentavos={datos.tcValorCentavos}
        alCerrar={cerrarHojas}
      />
      <AgregarTenencia
        abierta={alta}
        sesion={sesion}
        tcFuente={datos.tcFuente}
        tcValorCentavos={datos.tcValorCentavos}
        alCerrar={cerrarHojas}
      />
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
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titulo: { fontSize: 22, fontFamily: fuente.textoSemi, color: color.tinta },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.tinta,
  },
  avatarTexto: { fontSize: 14, fontFamily: fuente.textoSemi, color: color.papel },
  etiqueta: { fontSize: 12, fontFamily: fuente.textoMedio, color: color.tintaSecundaria },
  filaTotal: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  aprox: { fontSize: 20, fontFamily: fuente.monoMedio, fontVariant: ["tabular-nums"], color: color.tintaSecundaria },
  usd: { marginTop: 4, fontSize: 14, fontFamily: fuente.monoMedio, fontVariant: ["tabular-nums"], color: color.tintaSecundaria },
  tc: { marginTop: 6, fontSize: 11, color: color.tintaSecundaria },
  // fila única de composición: nombre 110 + barra 6px + % mono, como la web
  compFila: { flexDirection: "row", alignItems: "center", gap: 10 },
  compNombre: { width: 110, fontSize: 12, color: color.tintaSecundaria },
  compPista: {
    flex: 1,
    minWidth: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: color.pista,
    overflow: "hidden",
  },
  compPorcentaje: {
    width: 36,
    textAlign: "right",
    fontSize: 11,
    fontFamily: fuente.mono,
    fontVariant: ["tabular-nums"],
    color: color.tintaSecundaria,
  },
  tenencia: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  tenenciaNombre: { fontSize: 14, fontFamily: fuente.textoMedio, color: color.tinta },
  tenenciaMeta: { marginTop: 2, fontSize: 11, color: color.tintaSecundaria },
  conBorde: { borderTopWidth: 1, borderTopColor: color.separador },
  // el sufijo es acción, no alarma: VERDE aunque la fila esté en ámbar
  actualizar: { color: color.verde, fontFamily: fuente.textoMedio },
  pieAgregar: {
    borderTopWidth: 1,
    borderTopColor: color.separador,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pieAgregarTexto: {
    fontSize: 13.5,
    fontFamily: fuente.textoMedio,
    color: color.verde,
  },
});
