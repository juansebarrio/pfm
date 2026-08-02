import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { formatearImporte, usdAArs } from "@dominio/dinero";
import { hoyBA } from "@dominio/fechas";
import {
  CON_TOGGLE_MONEDA,
  ETIQUETA_INSTRUMENTO,
  INSTRUMENTOS,
  INSTRUMENTOS_EN_USD,
  etiquetaFuente,
  guardarTenencia,
  type Instrumento,
  type Moneda,
} from "@/lib/acciones-patrimonio";
import type { SesionHogar } from "@/lib/datos";
import { color, fuente, radio } from "@/lib/tema";
import { tacto } from "@/lib/tacto";

// Hoja de ALTA de tenencia (08): los campos esenciales de HojaTenencia de la
// web — lista cerrada de instrumentos, nombre autocompletado, detalle,
// cantidad en USD o valuación en pesos según el instrumento, y conversión en
// vivo que muestra QUÉ TC usó. Simplificado del alta web: la fecha de
// valuación es siempre HOY (sin selector de fecha) y la conversión se hace
// local con el TC activo de la pantalla, sin ida al servidor.

function monedaDerivada(instrumento: Instrumento): Moneda {
  return INSTRUMENTOS_EN_USD.has(instrumento) ? "USD" : "ARS";
}

export function AgregarTenencia({
  abierta,
  sesion,
  tcFuente,
  tcValorCentavos,
  alCerrar,
}: {
  abierta: boolean;
  sesion: SesionHogar | null;
  /** TC activo de la pantalla, para la conversión en vivo de instrumentos en USD */
  tcFuente: string | null;
  tcValorCentavos: number | null;
  alCerrar: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [instrumento, setInstrumento] = useState<Instrumento | null>(null);
  const [nombre, setNombre] = useState("");
  // mientras el nombre no fue tocado, elegir instrumento lo autocompleta
  const [nombreEditado, setNombreEditado] = useState(false);
  const [detalle, setDetalle] = useState("");
  const [moneda, setMoneda] = useState<Moneda>("ARS");
  const [cantidadUsd, setCantidadUsd] = useState("");
  const [valuacionPesos, setValuacionPesos] = useState("");
  const [guardando, setGuardando] = useState(false);

  // cada apertura arranca vacía
  useEffect(() => {
    if (abierta) {
      setInstrumento(null);
      setNombre("");
      setNombreEditado(false);
      setDetalle("");
      setMoneda("ARS");
      setCantidadUsd("");
      setValuacionPesos("");
      setGuardando(false);
    }
  }, [abierta]);

  function elegirInstrumento(elegido: Instrumento) {
    tacto.toque();
    setInstrumento(elegido);
    setMoneda(monedaDerivada(elegido));
    if (!nombreEditado) setNombre(ETIQUETA_INSTRUMENTO[elegido]);
  }

  const esUsd = moneda === "USD";
  const valorTexto = esUsd ? cantidadUsd : valuacionPesos;
  const valorCentavos = /^\d+$/.test(valorTexto) ? Number(valorTexto) * 100 : null;
  const listo =
    instrumento !== null &&
    nombre.trim() !== "" &&
    valorCentavos !== null &&
    valorCentavos > 0;

  // conversión en vivo con el MISMO TC que ya muestra la pantalla
  const conversionArs =
    esUsd && valorCentavos !== null && valorCentavos > 0 && tcValorCentavos !== null
      ? usdAArs(valorCentavos, tcValorCentavos)
      : null;

  async function guardar() {
    if (!listo || guardando || !sesion || !instrumento || valorCentavos === null)
      return;
    setGuardando(true);
    const r = await guardarTenencia(sesion, {
      tenenciaId: null,
      instrumento,
      nombre: nombre.trim(),
      detalle: detalle.trim() === "" ? null : detalle.trim(),
      moneda,
      cantidadUsdCentavos: esUsd ? valorCentavos : null,
      valuacionCentavos: esUsd ? null : valorCentavos,
      fechaValuacion: hoyBA(),
    });
    if (r.ok) {
      tacto.guardado();
      alCerrar();
    } else {
      tacto.error();
      Alert.alert("No pudimos guardar la tenencia", r.error);
    }
    setGuardando(false);
  }

  return (
    <Modal visible={abierta} transparent animationType="slide" onRequestClose={alCerrar}>
      <KeyboardAvoidingView
        style={e.lleno}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={e.fondo} onPress={alCerrar} />
        <View style={[e.hoja, { paddingBottom: Math.max(20, insets.bottom) }]}>
          <View aria-hidden style={e.agarre} />
          <View style={e.filaTitulo}>
            <Text style={e.titulo}>Cargar tenencia</Text>
            <Pressable onPress={alCerrar} hitSlop={10}>
              <X size={22} color={color.tintaSecundaria} strokeWidth={2} />
            </Pressable>
          </View>

          <Text style={e.etiqueta}>Instrumento</Text>
          <ScrollView style={{ maxHeight: 176 }} keyboardShouldPersistTaps="handled">
            <View style={e.chips}>
              {INSTRUMENTOS.map((opcion) => {
                const activa = instrumento === opcion;
                return (
                  <Pressable
                    key={opcion}
                    onPress={() => elegirInstrumento(opcion)}
                    style={[e.chip, activa && e.chipActiva]}
                  >
                    <Text style={[e.chipTexto, activa && e.chipTextoActivo]}>
                      {ETIQUETA_INSTRUMENTO[opcion]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <Text style={e.etiqueta}>Nombre</Text>
          <TextInput
            value={nombre}
            maxLength={60}
            onChangeText={(texto) => {
              setNombre(texto);
              setNombreEditado(texto !== "");
            }}
            placeholder="Dólar MEP"
            placeholderTextColor={color.tintaTerciaria}
            style={e.input}
          />

          <Text style={e.etiqueta}>Detalle (opcional)</Text>
          <TextInput
            value={detalle}
            maxLength={80}
            onChangeText={setDetalle}
            placeholder="Mercado Pago + Galicia"
            placeholderTextColor={color.tintaTerciaria}
            style={e.input}
          />

          {instrumento && (
            <>
              <View style={e.filaMoneda}>
                <Text style={e.etiqueta}>
                  {esUsd ? "Cantidad en USD" : "Valuación en pesos"}
                </Text>
                {CON_TOGGLE_MONEDA.has(instrumento) && (
                  <View style={e.toggle}>
                    {(["USD", "ARS"] as const).map((m) => (
                      <Pressable
                        key={m}
                        onPress={() => {
                          tacto.toque();
                          setMoneda(m);
                        }}
                        style={[e.mini, moneda === m && e.miniActivo]}
                      >
                        <Text
                          style={[e.miniTexto, moneda === m && e.miniTextoActivo]}
                        >
                          {m}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
              <View style={e.campo}>
                <Text style={e.prefijo}>{esUsd ? "USD" : "$"}</Text>
                <TextInput
                  value={valorTexto}
                  onChangeText={(texto) => {
                    const limpio = texto.replace(/\D/g, "").slice(0, 9);
                    if (esUsd) setCantidadUsd(limpio);
                    else setValuacionPesos(limpio);
                  }}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={color.tintaTerciaria}
                  style={e.valor}
                />
              </View>
              {conversionArs !== null && tcFuente !== null && tcValorCentavos !== null && (
                <Text style={e.conversion}>
                  ≈ {formatearImporte(conversionArs)} al {etiquetaFuente(tcFuente)}{" "}
                  {formatearImporte(tcValorCentavos)}
                </Text>
              )}
            </>
          )}

          <Pressable
            onPress={guardar}
            disabled={!listo || guardando}
            style={[e.cta, (!listo || guardando) && { opacity: 0.4 }]}
          >
            <Text style={e.ctaTexto}>
              {guardando ? "Guardando…" : "Guardar tenencia"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const e = StyleSheet.create({
  lleno: { flex: 1, justifyContent: "flex-end" },
  fondo: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: "rgba(20, 19, 18, 0.6)",
  },
  hoja: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  agarre: {
    alignSelf: "center",
    height: 4,
    width: 36,
    borderRadius: 2,
    backgroundColor: color.tintaMuda,
  },
  filaTitulo: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titulo: { fontSize: 16, fontWeight: "600", color: color.tinta },
  etiqueta: { marginTop: 14, marginBottom: 6, fontSize: 11.5, color: color.tintaSecundaria },
  // grilla 2 columnas como la hoja web (grid-cols-2)
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexGrow: 1,
    flexBasis: "47%",
    alignItems: "center",
    borderRadius: radio.chip,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.papel,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  chipActiva: { borderColor: color.verde, backgroundColor: color.verdeSuave },
  chipTexto: { fontSize: 12.5, fontWeight: "500", color: color.tintaSecundaria },
  chipTextoActivo: { color: color.verde },
  input: {
    height: 44,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.papel,
    paddingHorizontal: 12,
    fontSize: 15,
    color: color.tinta,
  },
  filaMoneda: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  toggle: { flexDirection: "row", gap: 4 },
  mini: {
    borderRadius: radio.chipMini,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.papel,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  miniActivo: { borderColor: color.verde, backgroundColor: color.verdeSuave },
  miniTexto: { fontSize: 10.5, fontWeight: "500", color: color.tintaSecundaria },
  miniTextoActivo: { color: color.verde },
  campo: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.papel,
    paddingHorizontal: 14,
  },
  prefijo: { fontSize: 16, fontFamily: fuente.mono, color: color.tintaSecundaria },
  valor: {
    flex: 1,
    fontSize: 22,
    fontFamily: fuente.monoSemi,
    fontVariant: ["tabular-nums"],
    color: color.tinta,
  },
  conversion: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: fuente.mono,
    fontVariant: ["tabular-nums"],
    color: color.tintaSecundaria,
  },
  cta: {
    marginTop: 16,
    height: 48,
    borderRadius: radio.cta,
    backgroundColor: color.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaTexto: { fontSize: 15, fontWeight: "600", color: color.papel },
});
