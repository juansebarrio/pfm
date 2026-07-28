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
import { CalendarClock, CreditCard, Inbox, type LucideIcon } from "lucide-react-native";
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
  type Aviso,
  type MovimientoFila,
  type PresupuestoMes,
  type SesionHogar,
} from "@/lib/datos";
import { color, radio } from "@/lib/tema";
import {
  Badge,
  BarraAvance,
  Card,
  EncabezadoSeccion,
  FilaMovimiento,
  Importe,
} from "@/componentes/sistema";

// 04 — Resumen. Corta a propósito: disponible del mes, qué atender hoy y los
// últimos 3 movimientos. Nada más.

const iconosAviso: Record<Aviso["tipo"], LucideIcon> = {
  cierre: CreditCard,
  vencimiento: CalendarClock,
  bandeja: Inbox,
};

export default function Resumen() {
  const insets = useSafeAreaInsets();
  const [sesion, setSesion] = useState<SesionHogar | null>(null);
  const [presupuesto, setPresupuesto] = useState<PresupuestoMes | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const hoy = hoyBA();
  const mes = mesDe(hoy);

  const cargar = useCallback(async () => {
    const s = await obtenerSesionHogar();
    if (!s) return;
    setSesion(s);
    const [p, a, m] = await Promise.all([
      obtenerPresupuestoMes(s, mes, "hogar"),
      avisosParaAtender(s),
      movimientosCategorizados(s, 3),
    ]);
    setPresupuesto(p);
    setAvisos(a);
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
        <Card style={{ marginTop: 16, paddingHorizontal: 14, paddingVertical: 14 }}>
          <Text style={e.cardEtiqueta}>
            Disponible en {formatearMesSolo(mes)} · Hogar
          </Text>
          <View style={{ marginTop: 4 }}>
            <Importe centavos={presupuesto.disponibleCentavos} variante="card" />
          </View>
          <BarraAvance
            progreso={progreso}
            tono="tinta"
            marcadorDia={diaDelMes(hoy) / diasDelMes(hoy)}
            style={{ marginTop: 12 }}
          />
          <View style={e.filaPie}>
            <Text style={e.pieTexto}>{formatearPorcentaje(progreso * 100)} gastado</Text>
            <Text style={[e.pieTexto, { color: color.verde }]}>
              {quedanDias === 1 ? "queda 1 día" : `quedan ${quedanDias} días`}
            </Text>
          </View>
        </Card>
      ) : (
        <Card style={{ marginTop: 16, paddingHorizontal: 14, paddingVertical: 16 }}>
          <Text style={e.vacio}>Armá tu presupuesto de {formatearMesSolo(mes)} →</Text>
        </Card>
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
  cardEtiqueta: { fontSize: 12, fontWeight: "500", color: color.tintaSecundaria },
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
