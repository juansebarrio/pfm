import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { formatearImporte, usdAArs } from "@dominio/dinero";
import { etiquetaDia, formatearDiaCorto, hoyBA } from "@dominio/fechas";
import {
  desactivarTenencia,
  etiquetaFuente,
  revaluarTenencia,
  type TenenciaEditable,
} from "@/lib/acciones-patrimonio";
import type { SesionHogar } from "@/lib/datos";
import { color, fuente, radio } from "@/lib/tema";
import { tacto } from "@/lib/tacto";

// Hoja mínima de REVALUACIÓN (08): tocar una tenencia deja poner el valor de
// hoy, con el valor actual precargado y la fecha de la última valuación a la
// vista. Es el modo edición de HojaTenencia de la web reducido a su acción
// frecuente: actualizar cuánto vale. Guardar el mismo valor también renueva la
// frescura. "Desactivar" espeja el mismo botón de la hoja web.

/** "hoy 10 jul" / "ayer 9 jul" / "8 jul" — mismo formato que la leyenda del TC. */
function etiquetaFecha(fecha: string, hoy: string): string {
  const corto = formatearDiaCorto(fecha);
  const relativa = etiquetaDia(fecha, hoy).toLowerCase();
  return relativa === corto ? corto : `${relativa} ${corto}`;
}

export function RevaluarTenencia({
  tenencia,
  sesion,
  tcFuente,
  tcValorCentavos,
  alCerrar,
}: {
  tenencia: TenenciaEditable | null;
  sesion: SesionHogar | null;
  /** TC activo de la pantalla, para la conversión en vivo de tenencias en USD */
  tcFuente: string | null;
  tcValorCentavos: number | null;
  alCerrar: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [valorTexto, setValorTexto] = useState("");
  const [guardando, setGuardando] = useState(false);

  // cada apertura arranca del valor actual (enteros, como la hoja web)
  useEffect(() => {
    if (tenencia) {
      const centavos =
        tenencia.moneda === "USD"
          ? tenencia.cantidadUsdCentavos
          : tenencia.valuacionCentavos;
      setValorTexto(centavos !== null ? String(Math.round(centavos / 100)) : "");
      setGuardando(false);
    }
  }, [tenencia]);

  const esUsd = tenencia?.moneda === "USD";
  const valorCentavos = /^\d+$/.test(valorTexto) ? Number(valorTexto) * 100 : null;
  const listo = valorCentavos !== null && valorCentavos > 0;

  // conversión en vivo con el MISMO TC que ya muestra la pantalla
  const conversionArs =
    esUsd && listo && tcValorCentavos !== null
      ? usdAArs(valorCentavos, tcValorCentavos)
      : null;

  async function guardar() {
    if (!listo || guardando || !sesion || !tenencia || valorCentavos === null) return;
    setGuardando(true);
    const r = await revaluarTenencia(sesion, tenencia, valorCentavos);
    if (r.ok) {
      tacto.guardado();
      alCerrar();
    } else {
      tacto.error();
      Alert.alert("No pudimos guardar la valuación", r.error);
    }
    setGuardando(false);
  }

  function desactivar() {
    if (!sesion || !tenencia || guardando) return;
    Alert.alert(`¿Desactivar ${tenencia.nombre}?`, "Deja de contar en el total.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Desactivar",
        style: "destructive",
        onPress: async () => {
          setGuardando(true);
          const r = await desactivarTenencia(sesion, tenencia.id);
          if (r.ok) {
            tacto.guardado();
            alCerrar();
          } else {
            tacto.error();
            Alert.alert("No pudimos desactivar", r.error);
          }
          setGuardando(false);
        },
      },
    ]);
  }

  return (
    <Modal
      visible={tenencia !== null}
      transparent
      animationType="slide"
      onRequestClose={alCerrar}
    >
      <KeyboardAvoidingView
        style={e.lleno}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={e.fondo} onPress={alCerrar} />
        <View style={[e.hoja, { paddingBottom: Math.max(20, insets.bottom) }]}>
          <View aria-hidden style={e.agarre} />
          <View style={e.filaTitulo}>
            <Text numberOfLines={1} style={e.titulo}>
              {tenencia?.nombre ?? ""}
            </Text>
            <Pressable onPress={alCerrar} hitSlop={10}>
              <X size={22} color={color.tintaSecundaria} strokeWidth={2} />
            </Pressable>
          </View>

          <Text style={e.etiqueta}>
            {esUsd ? "Cantidad en USD" : "Valuación en pesos"}
          </Text>
          <View style={e.campo}>
            <Text style={e.prefijo}>{esUsd ? "USD" : "$"}</Text>
            <TextInput
              value={valorTexto}
              onChangeText={(texto) =>
                setValorTexto(texto.replace(/\D/g, "").slice(0, 9))
              }
              keyboardType="number-pad"
              autoFocus
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
          <Text style={e.nota}>
            Última valuación:{" "}
            <Text style={e.notaFecha}>
              {tenencia ? etiquetaFecha(tenencia.fechaValuacion, hoyBA()) : ""}
            </Text>
            . Al guardar queda valuada hoy.
          </Text>

          <Pressable
            onPress={guardar}
            disabled={!listo || guardando}
            style={[e.cta, (!listo || guardando) && { opacity: 0.4 }]}
          >
            <Text style={e.ctaTexto}>
              {guardando ? "Guardando…" : "Guardar valuación"}
            </Text>
          </Pressable>

          <Pressable onPress={desactivar} disabled={guardando} hitSlop={6}>
            <Text style={e.desactivar}>Desactivar</Text>
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
    gap: 12,
  },
  titulo: { flexShrink: 1, fontSize: 16, fontFamily: fuente.textoSemi, color: color.tinta },
  etiqueta: {
    marginTop: 16,
    fontSize: 11.5,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
  campo: {
    marginTop: 6,
    height: 56,
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
    fontSize: 26,
    fontFamily: fuente.monoSemi,
    fontVariant: ["tabular-nums"],
    color: color.tinta,
  },
  conversion: {
    marginTop: 8,
    fontSize: 12,
    fontFamily: fuente.mono,
    fontVariant: ["tabular-nums"],
    color: color.tintaSecundaria,
  },
  nota: {
    marginTop: 8,
    fontSize: 11.5,
    lineHeight: 16,
    fontFamily: fuente.texto,
    color: color.tintaTerciaria,
  },
  notaFecha: { fontFamily: fuente.mono, fontVariant: ["tabular-nums"] },
  cta: {
    marginTop: 16,
    height: 48,
    borderRadius: radio.cta,
    backgroundColor: color.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaTexto: { fontSize: 15, fontFamily: fuente.textoSemi, color: color.papel },
  desactivar: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 12,
    fontFamily: fuente.textoMedio,
    color: color.rojo,
  },
});
