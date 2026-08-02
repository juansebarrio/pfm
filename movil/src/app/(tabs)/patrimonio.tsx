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
import { arsAUsd, formatearImporte } from "@dominio/dinero";
import { etiquetaDia, formatearDiaCorto, hoyBA } from "@dominio/fechas";
import {
  obtenerPatrimonio,
  obtenerSesionHogar,
  type Patrimonio as DatosPatrimonio,
} from "@/lib/datos";
import { AIRE_PASTILLA, color, radio } from "@/lib/tema";
import { Card, EncabezadoSeccion, EstadoVacio, Importe } from "@/componentes/sistema";

// 08 — Patrimonio: total del hogar, composición y tenencias con su frescura.
// El hero redondea a la centena de mil con ≈ (DESIGN_NOTES §1.2); el detalle
// exacto vive en las filas. Las barras se normalizan al MÁXIMO, no al 100 %
// (regla del export §3.28).

// Misma aritmética que el hero web (app/(tabs)/patrimonio/page.tsx).
const CENTENA_DE_MIL = 10_000_000; // $ 100.000 en centavos
const CENTENA_USD = 10_000; // USD 100 en centavos

/** La sigla va en MAYÚSCULA (MEP); "blue" y "oficial" en minúscula (app/(tabs)/patrimonio/instrumentos.ts). */
function etiquetaFuente(fuente: string): string {
  return fuente === "mep" ? "MEP" : fuente;
}

/** "hoy 10 jul" / "ayer 9 jul" / "8 jul" — espeja etiquetaFechaTC de app/(tabs)/patrimonio/page.tsx. */
function etiquetaFechaTC(fecha: string, hoy: string): string {
  const corto = formatearDiaCorto(fecha);
  const relativa = etiquetaDia(fecha, hoy).toLowerCase();
  return relativa === corto ? corto : `${relativa} ${corto}`;
}

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
      <Text style={e.titulo}>Patrimonio</Text>

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
  filaTotal: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  aprox: { fontSize: 20, fontWeight: "500", color: color.tintaSecundaria },
  usd: { marginTop: 4, fontSize: 14, fontWeight: "500", color: color.tintaSecundaria },
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
