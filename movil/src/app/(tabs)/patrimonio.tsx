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
import { useFocusEffect } from "expo-router";
import { LineChart } from "lucide-react-native";
import { formatearImporte } from "@dominio/dinero";
import {
  obtenerPatrimonio,
  obtenerSesionHogar,
  type Patrimonio as DatosPatrimonio,
} from "@/lib/datos";
import { color, radio } from "@/lib/tema";
import { Card, EncabezadoSeccion, EstadoVacio, Importe } from "@/componentes/sistema";

// 08 — Patrimonio: total valuado, composición y tenencias con su frescura.
// Las barras se normalizan al MÁXIMO, no al 100 % (regla del export §3.28).

export default function Patrimonio() {
  const insets = useSafeAreaInsets();
  const [datos, setDatos] = useState<DatosPatrimonio | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    const s = await obtenerSesionHogar();
    if (!s) return;
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

  if (cargando) {
    return (
      <View style={e.centrado}>
        <ActivityIndicator color={color.verde} />
      </View>
    );
  }

  if (!datos || datos.tenencias.length === 0) {
    return (
      <View style={e.centrado}>
        <EstadoVacio
          Icono={LineChart}
          titulo="Todavía no cargaste tenencias"
          cuerpo="Sumá tus dólares, plazos fijos o inversiones y mirá cómo evoluciona tu patrimonio."
        />
      </View>
    );
  }

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
      <Text style={e.titulo}>Patrimonio</Text>

      {/* Total valuado + tipo de cambio activo */}
      <Card style={{ marginTop: 16, paddingHorizontal: 14, paddingVertical: 14 }}>
        <Text style={e.etiqueta}>Total valuado</Text>
        <View style={{ marginTop: 4 }}>
          <Importe centavos={datos.totalArsCentavos} variante="patrimonio" />
        </View>
        {datos.tcValorCentavos !== null && (
          <Text style={e.tc}>
            {datos.tcFuente?.toUpperCase()} {formatearImporte(datos.tcValorCentavos)}
          </Text>
        )}
      </Card>

      {/* Composición: barras normalizadas al máximo */}
      <EncabezadoSeccion>Composición</EncabezadoSeccion>
      <Card style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 10 }}>
        {datos.tenencias.map((t) => (
          <View key={`comp-${t.id}`}>
            <View style={e.compFila}>
              <Text numberOfLines={1} style={e.compNombre}>
                {t.nombre}
              </Text>
              <Text style={e.compPorcentaje}>{t.porcentaje} %</Text>
            </View>
            <View style={e.pista}>
              <View
                style={{
                  height: "100%",
                  borderRadius: 2,
                  backgroundColor: color.verde,
                  width: `${Math.max(2, t.fraccionDelMaximo * 100)}%`,
                }}
              />
            </View>
          </View>
        ))}
      </Card>

      {/* Tenencias con su frescura */}
      <EncabezadoSeccion>Tenencias</EncabezadoSeccion>
      <Card>
        {datos.tenencias.map((t, i) => (
          <View key={t.id} style={[e.tenencia, i > 0 && e.conBorde]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={e.tenenciaNombre}>
                {t.nombre}
              </Text>
              <Text
                numberOfLines={1}
                style={[e.tenenciaMeta, t.vieja && { color: color.ambarTexto }]}
              >
                {[t.detalle, t.frescura].filter(Boolean).join(" · ")}
              </Text>
            </View>
            <Importe centavos={t.valorArsCentavos} variante="filaChica" />
          </View>
        ))}
      </Card>
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
  etiqueta: { fontSize: 12, fontWeight: "500", color: color.tintaSecundaria },
  tc: { marginTop: 6, fontSize: 11, color: color.tintaSecundaria },
  compFila: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  compNombre: { flex: 1, fontSize: 12.5, color: color.tinta },
  compPorcentaje: { fontSize: 11, color: color.tintaSecundaria },
  pista: {
    marginTop: 5,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.pista,
    overflow: "hidden",
  },
  tenencia: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  tenenciaNombre: { fontSize: 14, fontWeight: "500", color: color.tinta },
  tenenciaMeta: { marginTop: 2, fontSize: 11, color: color.tintaSecundaria },
  conBorde: { borderTopWidth: 1, borderTopColor: color.separador },
});
