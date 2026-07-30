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
import { Wallet } from "lucide-react-native";
import { formatearImporte, formatearPorcentaje } from "@dominio/dinero";
import {
  diaDelMes,
  diasDelMes,
  formatearMesSolo,
  hoyBA,
  mesAnterior,
  mesDe,
} from "@dominio/fechas";
import { repetirPresupuesto } from "@/lib/acciones";
import {
  obtenerPresupuestoMes,
  obtenerSesionHogar,
  type PartidaConEstado,
  type PresupuestoMes,
  type SesionHogar,
} from "@/lib/datos";
import { NavegadorMes } from "@/componentes/NavegadorMes";
import { color, radio } from "@/lib/tema";
import {
  Card,
  CardPartida,
  EncabezadoSeccion,
  EstadoVacio,
  Importe,
  type DatosPartida,
} from "@/componentes/sistema";

// 01 — Presupuesto. Navegación por mes, segmented Hogar/Personal, hero con el
// disponible y las partidas agrupadas. Mismo léxico que la web (§3.6).

type Ambito = "hogar" | "personal";

/** PartidaConEstado → props de CardPartida, con el léxico verbatim del export. */
function aDatosPartida(p: PartidaConEstado, mes: string): DatosPartida {
  const notaDiceBroker = (p.nota ?? "").toLowerCase().includes("broker");
  return {
    nombre: p.nombre,
    icono: p.icono,
    asignadoCentavos: p.asignadoCentavos,
    gastadoCentavos: p.gastadoCentavos,
    rolloverCentavos: p.rolloverCentavos,
    fija: p.fija,
    rollover: p.rollover,
    estado: p.resultado.estado,
    excedenteProyectadoCentavos: p.resultado.excedenteProyectadoCentavos,
    sufijoMeta: notaDiceBroker || p.esAhorro ? "· a Broker" : p.fija ? "· fijo" : undefined,
    textoRollover:
      p.rolloverCentavos > 0
        ? `arrastrás + ${formatearImporte(p.rolloverCentavos)} de ${formatearMesSolo(mesAnterior(mes))}`
        : undefined,
    esAhorro: p.esAhorro,
  };
}

export default function Presupuesto() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const hoy = hoyBA();
  const [mes, setMes] = useState(mesDe(hoy));
  const [ambito, setAmbito] = useState<Ambito>("hogar");
  const [sesion, setSesion] = useState<SesionHogar | null>(null);
  const [presupuesto, setPresupuesto] = useState<PresupuestoMes | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const [hayAnterior, setHayAnterior] = useState(false);
  const [repitiendo, setRepitiendo] = useState(false);

  async function repetir() {
    if (!sesion || repitiendo) return;
    setRepitiendo(true);
    const r = await repetirPresupuesto(sesion, mes, ambito);
    if (r.ok) await cargar();
    else Alert.alert("No pudimos copiarlo", r.error);
    setRepitiendo(false);
  }

  const cargar = useCallback(async () => {
    const s = await obtenerSesionHogar();
    if (!s) return;
    setSesion(s);
    const p = await obtenerPresupuestoMes(s, mes, ambito);
    setPresupuesto(p);
    // solo importa cuando no hay presupuesto: habilita el "repetir" de un toque
    setHayAnterior(p ? false : (await obtenerPresupuestoMes(s, mesAnterior(mes), ambito)) !== null);
  }, [mes, ambito]);

  useEffect(() => {
    setCargando(true);
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

  const dias = diasDelMes(mes);
  const esMesActual = mesDe(hoy) === mes;
  const dia = esMesActual ? diaDelMes(hoy) : dias;
  const quedanDias = dias - dia;
  const fraccionGastada =
    presupuesto && presupuesto.asignadoCentavos > 0
      ? presupuesto.gastadoCentavos / presupuesto.asignadoCentavos
      : 0;

  return (
    <View style={e.pantalla}>
      {/* Encabezado: título + navegación de mes + segmented de ámbito.
          El cambio de mes usa el MISMO componente que Movimientos: antes eran
          dos chevrons pegados al título y allá una fila centrada, y dos formas
          de hacer lo mismo en pantallas hermanas se leen como dos apps. */}
      <View style={[e.encabezado, { paddingTop: insets.top + 12 }]}>
        <Text style={e.titulo}>Presupuesto</Text>
        <NavegadorMes mes={mes} mesActual={mesDe(hoy)} alCambiar={setMes} />
        <View style={e.segmented}>
          {(["hogar", "personal"] as const).map((a) => (
            <Pressable
              key={a}
              onPress={() => setAmbito(a)}
              style={[e.segmentoBoton, ambito === a && e.segmentoActivo]}
            >
              <Text style={[e.segmentoTexto, ambito === a && e.segmentoTextoActivo]}>
                {a === "hogar" ? "Hogar" : "Personal"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {cargando ? (
        <View style={e.centrado}>
          <ActivityIndicator color={color.verde} />
        </View>
      ) : !presupuesto ? (
        <View style={e.centrado}>
          <EstadoVacio
            Icono={Wallet}
            titulo="Armá tu primer presupuesto"
            cuerpo={`Asignale un monto a cada partida de ${formatearMesSolo(mes)}, como sobres de plata, y mirá cuánto queda a medida que cargás gastos.`}
            accion={{
              texto: "Armar presupuesto",
              onPress: () =>
                router.push({
                  pathname: "/armar-presupuesto",
                  params: { mes, ambito },
                }),
            }}
          />
          {/* con presupuesto el mes pasado, el arrastre es un toque */}
          {hayAnterior && (
            <Pressable onPress={repetir} disabled={repitiendo} hitSlop={8}>
              <Text style={e.repetir}>
                {repitiendo
                  ? "Copiando…"
                  : `Repetir el presupuesto de ${formatearMesSolo(mesAnterior(mes))}`}
              </Text>
            </Pressable>
          )}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
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
          {/* Hero: disponible del mes + barra con marcador del día */}
          <View style={{ paddingTop: 24 }}>
            <Text style={e.heroEtiqueta}>Disponible en {formatearMesSolo(mes)}</Text>
            <View style={{ marginTop: 4 }}>
              <Importe
                centavos={presupuesto.disponibleCentavos}
                variante="hero"
                color={presupuesto.disponibleCentavos < 0 ? color.rojo : color.tinta}
              />
            </View>
            <Text style={e.heroMeta}>
              asignado {formatearImporte(presupuesto.asignadoCentavos)} · gastado{" "}
              {formatearImporte(presupuesto.gastadoCentavos)}
            </Text>
            <View style={e.pistaHero}>
              <View
                style={{
                  height: "100%",
                  borderRadius: 2,
                  backgroundColor: color.tinta,
                  width: `${Math.min(100, fraccionGastada * 100)}%`,
                }}
              />
              {esMesActual && (
                <View
                  style={{
                    position: "absolute",
                    width: 2,
                    borderRadius: 1,
                    backgroundColor: color.verde,
                    left: `${(dia / dias) * 100}%`,
                    top: -3.5,
                    height: 11,
                  }}
                />
              )}
            </View>
            <View style={e.heroPie}>
              <Text style={e.heroPieTexto}>
                {formatearPorcentaje(fraccionGastada * 100)} gastado
              </Text>
              {esMesActual && (
                <Text style={[e.heroPieTexto, { color: color.verde }]}>
                  día {dia} de {dias} ·{" "}
                  {quedanDias === 1 ? "queda 1 día" : `quedan ${quedanDias} días`}
                </Text>
              )}
            </View>
          </View>

          {/* Grupos de partidas */}
          {presupuesto.grupos.map((g) => (
            <View key={g.grupo}>
              <EncabezadoSeccion>{g.grupo}</EncabezadoSeccion>
              <Card>
                {g.partidas.map((p, i) => (
                  <View key={p.id} style={i > 0 ? e.conBorde : undefined}>
                    <CardPartida {...aDatosPartida(p, mes)} />
                  </View>
                ))}
              </Card>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.papel },
  centrado: { flex: 1, alignItems: "center", justifyContent: "center" },
  encabezado: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: color.separador,
    gap: 10,
  },
  titulo: { fontSize: 22, fontWeight: "600", color: color.tinta },
  segmented: {
    flexDirection: "row",
    borderRadius: radio.chipChico,
    backgroundColor: color.fondoSegmented,
    padding: 2,
  },
  segmentoBoton: { flex: 1, borderRadius: 7, paddingVertical: 6, alignItems: "center" },
  segmentoActivo: { backgroundColor: color.segmentedActivo },
  segmentoTexto: { fontSize: 12, fontWeight: "500", color: color.tintaSecundaria },
  segmentoTextoActivo: { fontWeight: "600", color: color.tinta },
  repetir: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: "500",
    color: color.verde,
    textDecorationLine: "underline",
  },
  heroEtiqueta: { fontSize: 12, fontWeight: "500", color: color.tintaSecundaria },
  heroMeta: { marginTop: 4, fontSize: 11, color: color.tintaSecundaria },
  pistaHero: {
    marginTop: 12,
    height: 4,
    width: "100%",
    borderRadius: 2,
    backgroundColor: color.pista,
    position: "relative",
  },
  heroPie: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  heroPieTexto: { fontSize: 10.5, color: color.tintaSecundaria },
  conBorde: { borderTopWidth: 1, borderTopColor: color.separador },
});
