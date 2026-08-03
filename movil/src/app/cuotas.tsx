import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, CreditCard } from "lucide-react-native";
import { formatearImporte } from "@dominio/dinero";
import { formatearDiaCorto } from "@dominio/fechas";
import { comprasEnCuotas, obtenerSesionHogar, type CompraEnCuotas } from "@/lib/datos";
import { color, fuente } from "@/lib/tema";
import { BarraAvance, Card, EstadoVacio, Importe } from "@/componentes/sistema";

// 07 — Compras en cuotas: los compromisos vigentes con su progreso. Las series
// terminadas no se muestran: la pantalla es sobre lo que todavía se debe.

export default function Cuotas() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [compras, setCompras] = useState<CompraEnCuotas[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      const s = await obtenerSesionHogar();
      if (!s) return;
      setCompras(await comprasEnCuotas(s));
    })().finally(() => setCargando(false));
  }, []);

  const totalRestante = compras.reduce((s, c) => s + c.restanteCentavos, 0);

  return (
    <View style={e.pantalla}>
      <View style={[e.cabecera, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={20} color={color.tinta} strokeWidth={1.5} />
        </Pressable>
        <Text style={e.titulo}>Compras en cuotas</Text>
      </View>

      {cargando ? (
        <View style={e.centrado}>
          <ActivityIndicator color={color.verde} />
        </View>
      ) : compras.length === 0 ? (
        <View style={e.centrado}>
          <EstadoVacio
            Icono={CreditCard}
            titulo="No tenés compras en cuotas"
            cuerpo="Cuando cargues un gasto en cuotas con tarjeta, vas a ver acá cuánto te queda por pagar."
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 32,
          }}
        >
          {/* Comprometido a futuro: la cifra que importa */}
          <Card style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
            <Text style={e.etiqueta}>Comprometido a futuro</Text>
            <View style={{ marginTop: 4 }}>
              <Importe centavos={totalRestante} variante="hero" />
            </View>
            <Text style={e.meta}>
              en <Text style={e.cifra}>{compras.length}</Text>{" "}
              {compras.length === 1 ? "compra" : "compras"} activas
            </Text>
          </Card>

          <View style={{ marginTop: 16, gap: 8 }}>
            {compras.map((c) => (
              <Card key={c.id} style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                <View style={e.filaTitulo}>
                  <Text numberOfLines={1} style={e.descripcion}>
                    {c.descripcion}
                  </Text>
                  <Importe centavos={c.totalCentavos} variante="fila" />
                </View>
                <BarraAvance
                  progreso={c.pagadas / c.nCuotas}
                  tono="ok"
                  style={{ marginTop: 8 }}
                />
                <View style={e.filaPie}>
                  <Text style={e.pieTexto}>
                    cuota{" "}
                    <Text style={e.cifra}>
                      {c.pagadas} de {c.nCuotas}
                    </Text>
                    {c.tarjeta ? ` · ${c.tarjeta}` : ""}
                  </Text>
                  <Text style={[e.pieTexto, { color: color.ambarTexto }]}>
                    quedan{" "}
                    <Text style={e.cifra}>{formatearImporte(c.restanteCentavos)}</Text>
                  </Text>
                </View>
                <Text style={e.compra}>
                  comprada el <Text style={e.cifra}>{formatearDiaCorto(c.fecha)}</Text>
                </Text>
              </Card>
            ))}
          </View>
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
  titulo: { fontSize: 17, fontFamily: fuente.textoSemi, color: color.tinta },
  etiqueta: { fontSize: 12, fontFamily: fuente.textoMedio, color: color.tintaSecundaria },
  meta: {
    marginTop: 4,
    fontSize: 11,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
  // el pedazo de cifra dentro de una frase en Rubik (DESIGN_AUDIT §2.2)
  cifra: { fontFamily: fuente.mono, fontVariant: ["tabular-nums"] },
  filaTitulo: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
  },
  descripcion: {
    flex: 1,
    fontSize: 14,
    fontFamily: fuente.textoMedio,
    color: color.tinta,
  },
  filaPie: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  pieTexto: { fontSize: 11, fontFamily: fuente.texto, color: color.tintaSecundaria },
  compra: {
    marginTop: 4,
    fontSize: 10.5,
    fontFamily: fuente.texto,
    color: color.tintaTerciaria,
  },
});
