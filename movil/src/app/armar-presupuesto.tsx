import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { formatearImporte } from "@dominio/dinero";
import { formatearMesLargo, hoyBA, mesDe, mesSiguiente } from "@dominio/fechas";
import { obtenerSesionHogar, type SesionHogar } from "@/lib/datos";
import { armarPresupuesto, baseParaArmar, type PartidaArmado } from "@/lib/acciones";
import { color, radio } from "@/lib/tema";
import { Card, IconoCategoria } from "@/componentes/sistema";

// 02 — Armar presupuesto. Se sugiere lo del mes anterior por partida; se
// prende/apaga cada una y se ajusta el monto. El total se ve en vivo abajo.

/** 780000 → "780.000". Se escribe en pesos enteros; los centavos van a cero. */
function conPuntos(centavos: number): string {
  if (centavos <= 0) return "";
  return String(Math.round(centavos / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export default function ArmarPresupuesto() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mes?: string; ambito?: string }>();

  const mes =
    params.mes && /^\d{4}-\d{2}-01$/.test(params.mes)
      ? params.mes
      : mesSiguiente(mesDe(hoyBA()));
  const ambito: "hogar" | "personal" =
    params.ambito === "personal" ? "personal" : "hogar";

  const [sesion, setSesion] = useState<SesionHogar | null>(null);
  const [partidas, setPartidas] = useState<PartidaArmado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const s = await obtenerSesionHogar();
      if (!s) return;
      setSesion(s);
      setPartidas(await baseParaArmar(s, mes, ambito));
    })().finally(() => setCargando(false));
  }, [mes, ambito]);

  function actualizar(categoriaId: string, cambios: Partial<PartidaArmado>) {
    setPartidas((prev) =>
      prev.map((p) => (p.categoriaId === categoriaId ? { ...p, ...cambios } : p)),
    );
  }

  const activas = partidas.filter((p) => p.activa);
  const total = activas.reduce((s, p) => s + p.asignadoCentavos, 0);

  async function guardar() {
    if (!sesion || pendiente) return;
    if (activas.length === 0) {
      setError("Prendé al menos una partida");
      return;
    }
    setError(null);
    setPendiente(true);
    const r = await armarPresupuesto(sesion, mes, ambito, partidas);
    if (r.ok) router.back();
    else {
      setError(r.error);
      setPendiente(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={e.pantalla}
    >
      <View style={[e.cabecera, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={20} color={color.tinta} strokeWidth={1.5} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={e.titulo}>Armar presupuesto</Text>
          <Text style={e.subtitulo}>
            {formatearMesLargo(mes)} · {ambito === "hogar" ? "Hogar" : "Personal"}
          </Text>
        </View>
      </View>

      {cargando ? (
        <View style={e.centrado}>
          <ActivityIndicator color={color.verde} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={e.ayuda}>
            Asignale un monto a cada partida, como sobres de plata. Se sugiere lo
            del mes anterior.
          </Text>

          <Card style={{ marginTop: 12 }}>
            {partidas.map((p, i) => (
              <View
                key={p.categoriaId}
                style={[e.fila, i > 0 && e.conBorde, !p.activa && { opacity: 0.5 }]}
              >
                <Pressable
                  onPress={() => actualizar(p.categoriaId, { activa: !p.activa })}
                  hitSlop={6}
                  style={[e.check, p.activa && e.checkOn]}
                >
                  {p.activa && <View style={e.checkPunto} />}
                </Pressable>
                <IconoCategoria nombre={p.icono} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={e.nombre}>
                    {p.nombre}
                  </Text>
                  {p.asignadoAnteriorCentavos > 0 && (
                    <Text style={e.anterior}>
                      mes anterior {formatearImporte(p.asignadoAnteriorCentavos)}
                    </Text>
                  )}
                </View>
                <TextInput
                  value={conPuntos(p.asignadoCentavos)}
                  onChangeText={(v) => {
                    // pesos enteros → centavos, sin floats
                    const pesos = v.replace(/\D/g, "").slice(0, 9);
                    actualizar(p.categoriaId, {
                      asignadoCentavos: pesos ? Number(pesos) * 100 : 0,
                      activa: pesos ? true : p.activa,
                    });
                  }}
                  placeholder="0"
                  placeholderTextColor={color.tintaTerciaria}
                  keyboardType="number-pad"
                  style={e.input}
                />
              </View>
            ))}
          </Card>
        </ScrollView>
      )}

      {/* Total en vivo + CTA */}
      {!cargando && (
        <View style={[e.pie, { paddingBottom: Math.max(16, insets.bottom) }]}>
          {error && <Text style={e.error}>{error}</Text>}
          <View style={e.totalFila}>
            <Text style={e.totalEtiqueta}>
              Total asignado · {activas.length}{" "}
              {activas.length === 1 ? "partida" : "partidas"}
            </Text>
            <Text style={e.total}>{formatearImporte(total)}</Text>
          </View>
          <Pressable
            onPress={guardar}
            disabled={pendiente}
            style={[e.cta, pendiente && { opacity: 0.6 }]}
          >
            {pendiente ? (
              <ActivityIndicator color={color.papel} />
            ) : (
              <Text style={e.ctaTexto}>Crear presupuesto</Text>
            )}
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
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
  titulo: { fontSize: 17, fontWeight: "600", color: color.tinta },
  subtitulo: { fontSize: 11.5, color: color.tintaSecundaria, textTransform: "capitalize" },
  ayuda: { marginTop: 4, fontSize: 12.5, lineHeight: 19, color: color.tintaSecundaria },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  conBorde: { borderTopWidth: 1, borderTopColor: color.separador },
  check: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: color.borde,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { borderColor: color.verde, backgroundColor: color.verdeSuave },
  checkPunto: { width: 9, height: 9, borderRadius: 2, backgroundColor: color.verde },
  nombre: { fontSize: 14, fontWeight: "500", color: color.tinta },
  anterior: { marginTop: 2, fontSize: 10.5, color: color.tintaTerciaria },
  input: {
    width: 106,
    height: 40,
    borderRadius: radio.chipChico,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.papel,
    paddingHorizontal: 10,
    fontSize: 15,
    textAlign: "right",
    color: color.tinta,
  },
  pie: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: color.separador,
    backgroundColor: color.papel,
  },
  totalFila: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  totalEtiqueta: { fontSize: 12, color: color.tintaSecundaria },
  total: { fontSize: 20, fontWeight: "600", color: color.tinta },
  error: {
    marginBottom: 8,
    textAlign: "center",
    fontSize: 12.5,
    fontWeight: "500",
    color: color.rojo,
  },
  cta: {
    marginTop: 12,
    borderRadius: radio.cta,
    backgroundColor: color.verde,
    paddingVertical: 15,
    alignItems: "center",
  },
  ctaTexto: { fontSize: 15, fontWeight: "600", color: color.papel },
});
