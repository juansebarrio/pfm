import { useEffect, useState } from "react";
import {
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
import { centavosDesdeTexto, formatearImporte } from "@dominio/dinero";
import { actualizarPartida, type Resultado } from "@/lib/acciones";
import type { SesionHogar } from "@/lib/datos";
import { color, fuente, radio } from "@/lib/tema";
import { tacto } from "@/lib/tacto";

// La partida se ajusta tocándola: hoja con el monto asignado y listo. Espeja
// PartidaEditable de la web — antes un presupuesto armado era intocable.

export type PartidaParaEditar = {
  id: string;
  nombre: string;
  asignadoCentavos: number;
  gastadoCentavos: number;
  fija: boolean;
};

export function EditarPartida({
  partida,
  sesion,
  alGuardar,
  alCerrar,
}: {
  partida: PartidaParaEditar | null;
  sesion: SesionHogar | null;
  alGuardar: () => Promise<void> | void;
  alCerrar: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [montoTexto, setMontoTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // cada apertura arranca del monto actual
  useEffect(() => {
    if (partida) {
      setMontoTexto(formatearImporte(partida.asignadoCentavos));
      setError(null);
    }
  }, [partida]);

  const montoCentavos = centavosDesdeTexto(montoTexto);
  const listo =
    partida !== null &&
    montoCentavos !== null &&
    montoCentavos !== partida.asignadoCentavos;

  async function guardar() {
    if (!listo || guardando || !sesion || !partida || montoCentavos === null) return;
    setGuardando(true);
    setError(null);
    const r: Resultado = await actualizarPartida(sesion, {
      partidaId: partida.id,
      asignadoCentavos: montoCentavos,
    });
    if (r.ok) {
      tacto.guardado();
      await alGuardar();
      alCerrar();
    } else {
      setError(r.error);
    }
    setGuardando(false);
  }

  return (
    <Modal
      visible={partida !== null}
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
            <Text style={e.titulo}>{partida?.nombre ?? ""}</Text>
            <Pressable onPress={alCerrar} hitSlop={10}>
              <X size={22} color={color.tintaSecundaria} strokeWidth={2} />
            </Pressable>
          </View>

          <Text style={e.etiqueta}>
            Asignado en el mes{partida?.fija ? " · partida fija" : ""}
          </Text>
          <TextInput
            value={montoTexto}
            onChangeText={setMontoTexto}
            keyboardType="decimal-pad"
            autoFocus
            style={[
              e.monto,
              montoTexto !== "" && montoCentavos === null && { borderColor: color.rojo },
            ]}
          />
          <Text style={e.nota}>
            Gastado hasta ahora: {formatearImporte(partida?.gastadoCentavos ?? 0)}. Cambiar
            el monto no toca los movimientos, solo cuánto le das al sobre.
          </Text>

          {error && <Text style={e.error}>{error}</Text>}

          <Pressable
            onPress={guardar}
            disabled={!listo || guardando}
            style={[e.cta, (!listo || guardando) && { opacity: 0.4 }]}
          >
            <Text style={e.ctaTexto}>{guardando ? "Guardando…" : "Guardar monto"}</Text>
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
  titulo: { fontSize: 16, fontFamily: fuente.textoSemi, color: color.tinta },
  etiqueta: {
    marginTop: 16,
    fontSize: 11.5,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
  monto: {
    marginTop: 6,
    height: 56,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.papel,
    paddingHorizontal: 14,
    fontSize: 26,
    // el monto es cifra: mono, como la clase .cifra de la hoja web
    fontFamily: fuente.monoSemi,
    fontVariant: ["tabular-nums"],
    color: color.tinta,
  },
  nota: {
    marginTop: 8,
    fontSize: 11.5,
    lineHeight: 16,
    fontFamily: fuente.texto,
    color: color.tintaTerciaria,
  },
  error: { marginTop: 8, fontSize: 12.5, fontFamily: fuente.texto, color: color.rojo },
  cta: {
    marginTop: 16,
    height: 48,
    borderRadius: radio.cta,
    backgroundColor: color.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaTexto: { fontSize: 15, fontFamily: fuente.textoSemi, color: color.papel },
});
