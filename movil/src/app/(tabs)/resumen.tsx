import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  obtenerPresupuestoMes,
  obtenerSesionHogar,
  ultimosMovimientos,
  type MovimientoFila,
  type ResumenPresupuesto,
  type SesionHogar,
} from "@/lib/datos";
import { color, radio } from "@/lib/tema";

export default function Resumen() {
  const insets = useSafeAreaInsets();
  const [sesion, setSesion] = useState<SesionHogar | null>(null);
  const [presupuesto, setPresupuesto] = useState<ResumenPresupuesto | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const hoy = hoyBA();
  const mes = mesDe(hoy);

  const cargar = useCallback(async () => {
    const s = await obtenerSesionHogar();
    if (!s) return;
    setSesion(s);
    const [p, m] = await Promise.all([
      obtenerPresupuestoMes(s, mes, "hogar"),
      ultimosMovimientos(s, 3),
    ]);
    setPresupuesto(p);
    setMovimientos(m);
  }, [mes]);

  useEffect(() => {
    cargar().finally(() => setCargando(false));
  }, [cargar]);

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
      {/* Encabezado: saludo + fecha + avatar */}
      <View style={e.encabezado}>
        <View>
          <Text style={e.saludo}>Hola, {sesion?.nombreMiembro ?? ""}</Text>
          <Text style={e.fecha}>{formatearDiaLargo(hoy)}</Text>
        </View>
        <View style={e.avatar}>
          <Text style={e.avatarTexto}>
            {(sesion?.nombreMiembro ?? "?").charAt(0).toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Card de disponible */}
      {presupuesto ? (
        <View style={e.card}>
          <Text style={e.cardEtiqueta}>
            Disponible en {formatearMesSolo(mes)} · Hogar
          </Text>
          <Text style={e.cifraHero}>
            {formatearImporte(presupuesto.disponibleCentavos)}
          </Text>

          <View style={e.pista}>
            <View style={[e.avance, { width: `${Math.min(100, progreso * 100)}%` }]} />
          </View>

          <View style={e.filaPie}>
            <Text style={e.pieTexto}>
              {formatearPorcentaje(progreso * 100)} gastado
            </Text>
            <Text style={[e.pieTexto, { color: color.verde }]}>
              {quedanDias === 1 ? "queda 1 día" : `quedan ${quedanDias} días`}
            </Text>
          </View>
        </View>
      ) : (
        <View style={[e.card, { paddingVertical: 16 }]}>
          <Text style={e.vacio}>Armá tu presupuesto de {formatearMesSolo(mes)} →</Text>
        </View>
      )}

      {/* Últimos movimientos */}
      {movimientos.length > 0 && (
        <>
          <Text style={e.tituloSeccion}>Últimos movimientos</Text>
          <View style={e.lista}>
            {movimientos.map((m, i) => (
              <View key={m.id} style={[e.fila, i > 0 && e.filaConBorde]}>
                <View style={e.filaTexto}>
                  <Text numberOfLines={1} style={e.descripcion}>
                    {m.descripcion}
                  </Text>
                  {m.categoria && (
                    <Text numberOfLines={1} style={e.meta}>
                      {m.categoria}
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={[e.importe, m.esIngreso && { color: color.verde }]}
                  >
                    {m.esIngreso ? "+ " : ""}
                    {formatearImporte(m.importeCentavos)}
                  </Text>
                  <View style={e.badge}>
                    <Text style={e.badgeTexto}>{m.ambito.toUpperCase()}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      <View style={{ height: insets.bottom + 24 }} />
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
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  saludo: { fontSize: 22, fontWeight: "600", color: color.tinta },
  fecha: { marginTop: 2, fontSize: 12.5, color: color.tintaSecundaria },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.tinta,
  },
  avatarTexto: { fontSize: 14, fontWeight: "600", color: color.papel },
  card: {
    marginTop: 16,
    borderRadius: radio.card,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cardEtiqueta: { fontSize: 12, fontWeight: "500", color: color.tintaSecundaria },
  cifraHero: { marginTop: 4, fontSize: 34, fontWeight: "500", color: color.tinta },
  pista: {
    marginTop: 12,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: color.pista,
  },
  avance: { height: "100%", borderRadius: 3, backgroundColor: color.tinta },
  filaPie: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  pieTexto: { fontSize: 10.5, color: color.tintaSecundaria },
  vacio: {
    textAlign: "center",
    fontSize: 13.5,
    fontWeight: "500",
    color: color.verde,
  },
  tituloSeccion: {
    marginTop: 24,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "600",
    color: color.tintaSecundaria,
  },
  lista: {
    borderRadius: radio.card,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    overflow: "hidden",
  },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  filaConBorde: { borderTopWidth: 1, borderTopColor: color.separador },
  filaTexto: { flex: 1, paddingRight: 12 },
  descripcion: { fontSize: 14, fontWeight: "500", color: color.tinta },
  meta: { marginTop: 2, fontSize: 11, color: color.tintaSecundaria },
  importe: { fontSize: 13, fontWeight: "600", color: color.tinta },
  badge: {
    marginTop: 4,
    borderRadius: radio.tag,
    borderWidth: 1,
    borderColor: color.borde,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeTexto: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: color.tintaSecundaria,
  },
});
