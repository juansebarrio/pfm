import { useEffect, useState } from "react";
import {
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
import { centavosDesdeTexto } from "@dominio/dinero";
import { agregarPartida, type Resultado } from "@/lib/acciones";
import type { SesionHogar } from "@/lib/datos";
import { IconoCategoria } from "@/componentes/sistema";
import { color, fuente, radio } from "@/lib/tema";
import { tacto } from "@/lib/tacto";

// Sumar una categoría a un mes YA armado. Espeja AgregarPartida de la web:
// solo se ofrecen las categorías sin partida en el mes.

export type CategoriaLibre = { id: string; nombre: string; icono: string };

export function AgregarPartida({
  abierta,
  mes,
  ambito,
  categorias,
  sesion,
  alGuardar,
  alCerrar,
}: {
  abierta: boolean;
  mes: string;
  ambito: "hogar" | "personal";
  categorias: CategoriaLibre[];
  sesion: SesionHogar | null;
  alGuardar: () => Promise<void> | void;
  alCerrar: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [montoTexto, setMontoTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // cada apertura arranca vacía
  useEffect(() => {
    if (abierta) {
      setCategoriaId(null);
      setMontoTexto("");
      setError(null);
    }
  }, [abierta]);

  const montoCentavos = centavosDesdeTexto(montoTexto);
  const listo = categoriaId !== null && montoCentavos !== null && montoCentavos > 0;

  async function guardar() {
    if (!listo || guardando || !sesion || categoriaId === null || montoCentavos === null)
      return;
    setGuardando(true);
    setError(null);
    const r: Resultado = await agregarPartida(sesion, {
      mes,
      ambito,
      categoriaId,
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
    <Modal visible={abierta} transparent animationType="slide" onRequestClose={alCerrar}>
      <KeyboardAvoidingView
        style={e.lleno}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={e.fondo} onPress={alCerrar} />
        <View style={[e.hoja, { paddingBottom: Math.max(20, insets.bottom) }]}>
          <View aria-hidden style={e.agarre} />
          <View style={e.filaTitulo}>
            <Text style={e.titulo}>Sumar una partida</Text>
            <Pressable onPress={alCerrar} hitSlop={10}>
              <X size={22} color={color.tintaSecundaria} strokeWidth={2} />
            </Pressable>
          </View>

          <Text style={e.etiqueta}>Categoría</Text>
          <ScrollView style={{ maxHeight: 170 }} keyboardShouldPersistTaps="handled">
            <View style={e.chips}>
              {categorias.map((c) => {
                const activa = categoriaId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      tacto.toque();
                      setCategoriaId(c.id);
                    }}
                    style={[e.chip, activa && e.chipActiva]}
                  >
                    <IconoCategoria nombre={c.icono} tamano={14} />
                    <Text style={[e.chipTexto, activa && e.chipTextoActivo]}>
                      {c.nombre}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <Text style={e.etiqueta}>Monto del mes</Text>
          <TextInput
            value={montoTexto}
            onChangeText={setMontoTexto}
            keyboardType="decimal-pad"
            placeholder="$ 0"
            placeholderTextColor={color.tintaTerciaria}
            style={[
              e.monto,
              montoTexto !== "" && montoCentavos === null && { borderColor: color.rojo },
            ]}
          />

          {error && <Text style={e.error}>{error}</Text>}

          <Pressable
            onPress={guardar}
            disabled={!listo || guardando}
            style={[e.cta, (!listo || guardando) && { opacity: 0.4 }]}
          >
            <Text style={e.ctaTexto}>{guardando ? "Sumando…" : "Sumar la partida"}</Text>
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
    marginBottom: 6,
    fontSize: 11.5,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.papel,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActiva: { borderColor: color.verde, backgroundColor: color.verdeSuave },
  chipTexto: { fontSize: 12.5, fontFamily: fuente.textoMedio, color: color.tintaSecundaria },
  chipTextoActivo: { color: color.verde },
  monto: {
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
