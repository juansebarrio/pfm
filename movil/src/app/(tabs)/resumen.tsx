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
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CalendarClock,
  CreditCard,
  Inbox,
  Sparkles,
  type LucideIcon,
} from "lucide-react-native";
// ⭐ Dominio COMPARTIDO con la web: los mismos archivos, sin copiar ni adaptar.
import { formatearImporte, formatearPorcentaje } from "@dominio/dinero";
import {
  diaDelMes,
  diasDelMes,
  formatearDiaLargo,
  formatearMesSolo,
  hoyBA,
  mesDe,
} from "@dominio/fechas";
import {
  avisosParaAtender,
  movimientosCategorizados,
  obtenerPresupuestoMes,
  obtenerSesionHogar,
  totalesDelMes,
  type Aviso,
  type MovimientoFila,
  type PresupuestoMes,
  type SesionHogar,
  type TotalesMes,
} from "@/lib/datos";
import { AIRE_PASTILLA, color, radio } from "@/lib/tema";
import {
  Badge,
  BarraAvance,
  Card,
  EncabezadoSeccion,
  FilaMovimiento,
  Importe,
} from "@/componentes/sistema";
import { DetalleMovimiento } from "@/componentes/DetalleMovimiento";
import { OnboardingAuto } from "@/componentes/Onboarding";
import {
  borrarMovimiento,
  categoriasDelHogar,
  mediosDePago,
  type CategoriaSimple,
  type MedioDePago,
} from "@/lib/acciones";

// 04 — Resumen. Corta a propósito: disponible del mes, qué atender hoy y los
// últimos 3 movimientos. Nada más.

const iconosAviso: Record<Aviso["tipo"], LucideIcon> = {
  cierre: CreditCard,
  vencimiento: CalendarClock,
  bandeja: Inbox,
};

export default function Resumen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sesion, setSesion] = useState<SesionHogar | null>(null);
  const [presupuesto, setPresupuesto] = useState<PresupuestoMes | null>(null);
  const [totales, setTotales] = useState<TotalesMes | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoFila[]>([]);
  const [categorias, setCategorias] = useState<CategoriaSimple[]>([]);
  const [medios, setMedios] = useState<MedioDePago[]>([]);
  const [detalle, setDetalle] = useState<MovimientoFila | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const hoy = hoyBA();
  const mes = mesDe(hoy);

  const cargar = useCallback(async () => {
    const s = await obtenerSesionHogar();
    if (!s) return;
    setSesion(s);
    const [p, a, m, c, md, t] = await Promise.all([
      obtenerPresupuestoMes(s, mes, "hogar"),
      avisosParaAtender(s),
      movimientosCategorizados(s, { limite: 3 }),
      categoriasDelHogar(s),
      mediosDePago(s),
      totalesDelMes(s, mes),
    ]);
    setPresupuesto(p);
    setTotales(t);
    setAvisos(a);
    setMovimientos(m);
    setCategorias(c);
    setMedios(md);
  }, [mes]);

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

  if (cargando) {
    return (
      <View style={e.centrado}>
        <ActivityIndicator color={color.verde} />
      </View>
    );
  }

  const quedanDias = diasDelMes(hoy) - diaDelMes(hoy);
  const progreso =
    presupuesto && presupuesto.asignadoCentavos > 0
      ? presupuesto.gastadoCentavos / presupuesto.asignadoCentavos
      : 0;

  return (
    <>
    {/* la bienvenida, solo la primera vez (AsyncStorage) */}
    <OnboardingAuto />
    <ScrollView
      style={e.pantalla}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20 }}
      refreshControl={
        <RefreshControl
          refreshing={refrescando}
          onRefresh={refrescar}
          tintColor={color.tintaSecundaria}
        />
      }
    >
      <View style={e.encabezado}>
        <View>
          <Text style={e.saludo}>Hola, {sesion?.nombreMiembro ?? ""}</Text>
          <Text style={e.fecha}>{formatearDiaLargo(hoy)}</Text>
        </View>
        <View style={e.accionesEncabezado}>
          <Pressable
            onPress={() => router.push("/asistente")}
            hitSlop={8}
            style={e.botonAsistente}
          >
            <Sparkles size={17} color={color.verde} strokeWidth={1.5} />
          </Pressable>
          <Pressable onPress={() => router.push("/hogar")} hitSlop={8} style={e.avatar}>
            <Text style={e.avatarTexto}>
              {(sesion?.nombreMiembro ?? "?").charAt(0).toUpperCase()}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Card principal: la CAJA del mes, como el totalizador de Movimientos —
          el balance (ingresos − gastos) protagonista y las dos cifras que lo
          componen en voz baja. Tocable → Movimientos. */}
      {totales && (
        <Pressable onPress={() => router.push("/movimientos")}>
          <Card style={{ marginTop: 16, paddingHorizontal: 14, paddingVertical: 14 }}>
            <Text style={e.cardEtiqueta}>Balance de {formatearMesSolo(mes)}</Text>
            <View style={{ marginTop: 4 }}>
              <Importe
                centavos={totales.ingresosCentavos - totales.gastosCentavos}
                variante="card"
                color={
                  totales.ingresosCentavos - totales.gastosCentavos < 0
                    ? color.rojo
                    : color.verde
                }
              />
            </View>
            <Text style={[e.pieTexto, { marginTop: 6 }]}>
              ingresos {formatearImporte(totales.ingresosCentavos)} · gastos{" "}
              {formatearImporte(totales.gastosCentavos)}
            </Text>
          </Card>
        </Pressable>
      )}

      {/* Card de disponible del presupuesto: segunda a propósito y en formato
          de DATO, no de héroe — etiqueta a la izquierda, cifra chica a la
          derecha y la barra como cuerpo de la card. */}
      {presupuesto ? (
        <Pressable onPress={() => router.push("/presupuesto")}>
          <Card style={{ marginTop: 10, paddingHorizontal: 14, paddingVertical: 12 }}>
            <View style={e.filaDato}>
              <Text style={e.cardEtiqueta}>Presupuesto · disponible</Text>
              <Text
                style={[
                  e.datoCifra,
                  presupuesto.disponibleCentavos < 0 && { color: color.rojo },
                ]}
              >
                {presupuesto.disponibleCentavos < 0 ? "− " : ""}
                {formatearImporte(Math.abs(presupuesto.disponibleCentavos))}
              </Text>
            </View>
            <BarraAvance
              progreso={progreso}
              tono="tinta"
              marcadorDia={diaDelMes(hoy) / diasDelMes(hoy)}
              style={{ marginTop: 10 }}
            />
            <View style={e.filaPie}>
              <Text style={e.pieTexto}>{formatearPorcentaje(progreso * 100)} gastado</Text>
              <Text style={[e.pieTexto, { color: color.verde }]}>
                {quedanDias === 1 ? "queda 1 día" : `quedan ${quedanDias} días`}
              </Text>
            </View>
          </Card>
        </Pressable>
      ) : (
        <Pressable
          onPress={() =>
            router.push({ pathname: "/armar-presupuesto", params: { mes, ambito: "hogar" } })
          }
        >
          <Card style={{ marginTop: 10, paddingHorizontal: 14, paddingVertical: 16 }}>
            <Text style={e.vacio}>Armá tu presupuesto de {formatearMesSolo(mes)} →</Text>
          </Card>
        </Pressable>
      )}

      {/* Para atender: cards sueltas apiladas */}
      <EncabezadoSeccion>Para atender</EncabezadoSeccion>
      {avisos.length === 0 ? (
        <Card style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
          <Text style={e.nada}>Nada urgente por hoy</Text>
        </Card>
      ) : (
        <View style={{ gap: 8 }}>
          {avisos.map((a) => {
            const Icono = iconosAviso[a.tipo];
            return (
              <Card key={a.id} style={e.aviso}>
                <Icono
                  size={18}
                  color={color.tintaSecundaria}
                  strokeWidth={1.5}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={e.avisoTitulo}>
                    {a.titulo}
                  </Text>
                  <View style={e.avisoMetaFila}>
                    <Text numberOfLines={1} style={e.avisoMeta}>
                      {a.meta}
                    </Text>
                    {a.badge && <Badge variante={a.badge}>{a.badge}</Badge>}
                  </View>
                </View>
                {a.accion && <Text style={e.avisoAccion}>{a.accion}</Text>}
              </Card>
            );
          })}
        </View>
      )}

      {/* Últimos movimientos: 3 filas, sin "ver más" */}
      {movimientos.length > 0 && (
        <>
          <EncabezadoSeccion>Últimos movimientos</EncabezadoSeccion>
          <Card>
            {movimientos.map((m, i) => (
              <Pressable
                key={m.id}
                onPress={() => setDetalle(m)}
                style={i > 0 ? e.conBorde : undefined}
              >
                <FilaMovimiento
                  descripcion={m.descripcion}
                  icono={m.icono}
                  metadata={[m.categoria, m.medio].filter(Boolean).join(" · ")}
                  importeCentavos={m.importeCentavos}
                  esIngreso={m.esIngreso}
                  ambito={m.ambito}
                  badgeCuota={m.badgeCuota}
                />
              </Pressable>
            ))}
          </Card>
        </>
      )}

      <View style={{ height: insets.bottom + AIRE_PASTILLA }} />
    </ScrollView>

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
    </>
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
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  saludo: { fontSize: 22, fontWeight: "600", color: color.tinta },
  fecha: { marginTop: 2, fontSize: 12.5, color: color.tintaSecundaria },
  accionesEncabezado: { flexDirection: "row", alignItems: "center", gap: 10 },
  botonAsistente: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.tinta,
  },
  avatarTexto: { fontSize: 14, fontWeight: "600", color: color.papel },
  cardEtiqueta: { fontSize: 12, fontWeight: "500", color: color.tintaSecundaria },
  filaDato: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  datoCifra: { fontSize: 17, fontWeight: "600", color: color.tinta },
  filaPie: { marginTop: 8, flexDirection: "row", justifyContent: "space-between" },
  pieTexto: { fontSize: 10.5, color: color.tintaSecundaria },
  vacio: { textAlign: "center", fontSize: 13.5, fontWeight: "500", color: color.verde },
  nada: { fontSize: 13, color: color.tintaSecundaria },
  aviso: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  avisoTitulo: { fontSize: 13.5, fontWeight: "500", color: color.tinta },
  avisoMetaFila: { marginTop: 3, flexDirection: "row", alignItems: "center", gap: 6 },
  avisoMeta: { fontSize: 11, color: color.tintaSecundaria, flexShrink: 1 },
  avisoAccion: { fontSize: 12.5, fontWeight: "500", color: color.verde },
  conBorde: { borderTopWidth: 1, borderTopColor: color.separador },
});
