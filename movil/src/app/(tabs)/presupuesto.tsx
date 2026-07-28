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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, Wallet } from "lucide-react-native";
import { formatearImporte, formatearPorcentaje } from "@dominio/dinero";
import {
  diaDelMes,
  diasDelMes,
  formatearMesLargo,
  formatearMesSolo,
  hoyBA,
  mesAnterior,
  mesDe,
  mesSiguiente,
} from "@dominio/fechas";
import {
  obtenerPresupuestoMes,
  obtenerSesionHogar,
  type PartidaConEstado,
  type PresupuestoMes,
  type SesionHogar,
} from "@/lib/datos";
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
  const insets = useSafeAreaInsets();
  const hoy = hoyBA();
  const [mes, setMes] = useState(mesDe(hoy));
  const [ambito, setAmbito] = useState<Ambito>("hogar");
  const [sesion, setSesion] = useState<SesionHogar | null>(null);
  const [presupuesto, setPresupuesto] = useState<PresupuestoMes | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    const s = await obtenerSesionHogar();
    if (!s) return;
    setSesion(s);
    setPresupuesto(await obtenerPresupuestoMes(s, mes, ambito));
  }, [mes, ambito]);

  useEffect(() => {
    setCargando(true);
    cargar().finally(() => setCargando(false));
  }, [cargar]);

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
      {/* Encabezado: navegación de mes + segmented de ámbito */}
      <View style={[e.encabezado, { paddingTop: insets.top + 12 }]}>
        <View style={e.navMes}>
          <Pressable onPress={() => setMes(mesAnterior(mes))} hitSlop={12}>
            <ChevronLeft size={20} color={color.tinta} strokeWidth={1.5} />
          </Pressable>
          <Text style={e.mesTitulo}>{formatearMesLargo(mes)}</Text>
          <Pressable onPress={() => setMes(mesSiguiente(mes))} hitSlop={12}>
            <ChevronRight size={20} color={color.tinta} strokeWidth={1.5} />
          </Pressable>
        </View>
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
          />
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
  navMes: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mesTitulo: {
    fontSize: 17,
    fontWeight: "600",
    color: color.tinta,
    textTransform: "capitalize",
  },
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
