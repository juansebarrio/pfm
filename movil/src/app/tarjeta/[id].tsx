import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { formatearImporte } from "@dominio/dinero";
import { formatearDiaCorto } from "@dominio/fechas";
import { obtenerSesionHogar, obtenerTarjeta, type DetalleTarjeta } from "@/lib/datos";
import { color } from "@/lib/tema";
import { Badge, Card, EncabezadoSeccion, Importe } from "@/componentes/sistema";

// 06 — Detalle de tarjeta: sus ciclos, del más nuevo al más viejo. El
// proyectado sale de los consumos del ciclo + los impuestos estimados; cuando
// el resumen ya se concilió, manda el total real.

const ETIQUETA_ESTADO: Record<string, string> = {
  abierto: "abierto",
  cerrado: "cerrado",
  conciliado: "conciliado",
};

export default function Tarjeta() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tarjeta, setTarjeta] = useState<DetalleTarjeta | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      const s = await obtenerSesionHogar();
      if (!s || !id) return;
      setTarjeta(await obtenerTarjeta(s, id));
    })().finally(() => setCargando(false));
  }, [id]);

  return (
    <View style={e.pantalla}>
      <View style={[e.cabecera, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={20} color={color.tinta} strokeWidth={1.5} />
        </Pressable>
        <Text numberOfLines={1} style={e.titulo}>
          {tarjeta ? `${tarjeta.nombre} •• ${tarjeta.ultimos4}` : "Tarjeta"}
        </Text>
      </View>

      {cargando ? (
        <View style={e.centrado}>
          <ActivityIndicator color={color.verde} />
        </View>
      ) : !tarjeta ? (
        <View style={e.centrado}>
          <Text style={e.vacio}>No encontramos esa tarjeta.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 32,
          }}
        >
          <Card style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
            <Text style={e.meta}>
              {tarjeta.banco}
              {tarjeta.diaCierre
                ? ` · cierra el ${tarjeta.diaCierre} de cada mes`
                : " · sin día de cierre"}
            </Text>
            {tarjeta.impuestosCentavos > 0 && (
              <Text style={[e.meta, { marginTop: 4 }]}>
                impuestos estimados por resumen:{" "}
                {formatearImporte(tarjeta.impuestosCentavos)}
              </Text>
            )}
          </Card>

          <EncabezadoSeccion>Ciclos</EncabezadoSeccion>
          {tarjeta.ciclos.length === 0 ? (
            <Card style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
              <Text style={e.meta}>
                Todavía no hay ciclos. Se crean solos al cargar el primer consumo.
              </Text>
            </Card>
          ) : (
            <View style={{ gap: 8 }}>
              {tarjeta.ciclos.map((c) => {
                // conciliado manda el total real; si no, el proyectado
                const conciliado = c.totalRealCentavos !== null;
                return (
                  <Card key={c.id} style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                    <View style={e.filaCiclo}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={e.cierre}>
                          Cierra el {formatearDiaCorto(c.fechaCierre)}
                        </Text>
                        <Text style={e.vence}>
                          vence el {formatearDiaCorto(c.fechaVencimiento)} ·{" "}
                          {ETIQUETA_ESTADO[c.estado] ?? c.estado}
                        </Text>
                      </View>
                      <Badge
                        variante={c.estadoFechas === "confirmado" ? "confirmada" : "estimada"}
                      >
                        {c.estadoFechas === "confirmado" ? "confirmada" : "estimada"}
                      </Badge>
                    </View>
                    <View style={e.filaTotal}>
                      <Text style={e.totalEtiqueta}>
                        {conciliado ? "total del resumen" : "proyectado"}
                      </Text>
                      <Importe
                        centavos={c.totalRealCentavos ?? c.proyectadoCentavos}
                        variante="fila"
                      />
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.papel },
  centrado: { flex: 1, alignItems: "center", justifyContent: "center" },
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  titulo: { flex: 1, fontSize: 17, fontWeight: "600", color: color.tinta },
  meta: { fontSize: 12, color: color.tintaSecundaria },
  vacio: { fontSize: 14, color: color.tintaSecundaria },
  filaCiclo: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cierre: { fontSize: 14, fontWeight: "500", color: color.tinta },
  vence: { marginTop: 2, fontSize: 11, color: color.tintaSecundaria },
  filaTotal: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: color.separador,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  totalEtiqueta: { fontSize: 11, color: color.tintaSecundaria },
});
