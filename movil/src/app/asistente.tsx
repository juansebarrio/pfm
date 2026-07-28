import { useEffect, useRef, useState } from "react";
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
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowUp, ChevronLeft, Sparkles } from "lucide-react-native";
import { obtenerSesionHogar } from "@/lib/datos";
import { preguntarAlAsistente, type MensajeChat } from "@/lib/asistente";
import { color, radio } from "@/lib/tema";

// Asistente financiero. Espeja app/asistente/Chat.tsx: historial en memoria,
// nada se persiste. La respuesta llega en streaming — ver lib/asistente.ts
// para por qué usa expo/fetch y no el fetch global.

const SUGERENCIAS = [
  "¿Cómo vengo este mes?",
  "¿En qué estoy gastando de más?",
  "¿Qué vence pronto?",
  "¿Me conviene pagar el total de la tarjeta?",
];

const MAX_HISTORIAL = 24;

export default function Asistente() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [nombre, setNombre] = useState("");
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [borrador, setBorrador] = useState("");
  const [pensando, setPensando] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    obtenerSesionHogar().then((s) => s && setNombre(s.nombreMiembro));
  }, []);

  // al desmontar, cortamos el stream en curso
  useEffect(() => () => abortRef.current?.abort(), []);

  async function enviar(texto: string) {
    const limpio = texto.trim();
    if (!limpio || pensando) return;

    const historial: MensajeChat[] = [
      ...mensajes.slice(-(MAX_HISTORIAL - 2)),
      { rol: "usuario", texto: limpio },
    ];
    setMensajes([...historial, { rol: "asistente", texto: "" }]);
    setBorrador("");
    setPensando(true);

    const controlador = new AbortController();
    abortRef.current = controlador;

    let acumulado = "";
    try {
      await preguntarAlAsistente(
        historial,
        (pedazo) => {
          acumulado += pedazo;
          const actual = acumulado;
          setMensajes((prev) => {
            const copia = [...prev];
            copia[copia.length - 1] = { rol: "asistente", texto: actual };
            return copia;
          });
        },
        controlador.signal,
      );
      if (acumulado.trim() === "") throw new Error("");
    } catch (e) {
      if (controlador.signal.aborted) return;
      const detalle = e instanceof Error ? e.message : "";
      const texto = detalle || "No pude responder. Fijate la conexión y probá de nuevo.";
      setMensajes((prev) => {
        const copia = [...prev];
        copia[copia.length - 1] = { rol: "asistente", texto };
        return copia;
      });
    } finally {
      setPensando(false);
    }
  }

  const vacio = mensajes.length === 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={e.pantalla}
    >
      <View style={[e.cabecera, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={20} color={color.tinta} strokeWidth={1.5} />
        </Pressable>
        <Text style={e.titulo}>Asistente</Text>
      </View>

      {vacio ? (
        <View style={e.inicial}>
          <View style={e.circulo}>
            <Sparkles size={28} color={color.verde} strokeWidth={1.5} />
          </View>
          <Text style={e.saludo}>Hola, {nombre}</Text>
          <Text style={e.bajada}>
            Preguntame sobre tus números: veo tu presupuesto, tus tarjetas y tu
            patrimonio de este mes.
          </Text>
          <View style={e.sugerencias}>
            {SUGERENCIAS.map((s) => (
              <Pressable key={s} onPress={() => enviar(s)} style={e.chip}>
                <Text style={e.chipTexto}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16, gap: 12 }}
          keyboardShouldPersistTaps="handled"
        >
          {mensajes.map((m, i) => (
            <View
              key={i}
              style={m.rol === "usuario" ? e.burbujaUsuario : e.burbujaAsistente}
            >
              <Text
                style={m.rol === "usuario" ? e.textoUsuario : e.textoAsistente}
              >
                {m.texto ||
                  (pensando && i === mensajes.length - 1 ? "Pensando…" : "")}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={[e.pie, { paddingBottom: Math.max(14, insets.bottom) }]}>
        <View style={e.filaInput}>
          <TextInput
            value={borrador}
            onChangeText={setBorrador}
            maxLength={2000}
            placeholder="Preguntá sobre tus finanzas…"
            placeholderTextColor={color.tintaTerciaria}
            style={e.input}
            onSubmitEditing={() => enviar(borrador)}
            returnKeyType="send"
          />
          <Pressable
            onPress={() => enviar(borrador)}
            disabled={borrador.trim() === "" || pensando}
            style={[
              e.enviar,
              (borrador.trim() === "" || pensando) && { opacity: 0.5 },
            ]}
          >
            {pensando ? (
              <ActivityIndicator color={color.papel} size="small" />
            ) : (
              <ArrowUp size={20} color={color.papel} strokeWidth={2} />
            )}
          </Pressable>
        </View>
        <Text style={e.aviso}>
          Orientación general con IA — no es asesoramiento financiero profesional.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.papel },
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  titulo: { fontSize: 17, fontWeight: "600", color: color.tinta },
  inicial: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  circulo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: color.verdeSuave,
    alignItems: "center",
    justifyContent: "center",
  },
  saludo: { marginTop: 20, fontSize: 19, fontWeight: "600", color: color.tinta },
  bajada: {
    marginTop: 10,
    maxWidth: 280,
    fontSize: 13.5,
    lineHeight: 21,
    textAlign: "center",
    color: color.tintaSecundaria,
  },
  sugerencias: {
    marginTop: 24,
    maxWidth: 320,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  chip: {
    borderRadius: radio.chip,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipTexto: { fontSize: 12.5, color: color.tinta },
  burbujaUsuario: {
    alignSelf: "flex-end",
    maxWidth: "85%",
    borderRadius: radio.cta,
    borderBottomRightRadius: 4,
    backgroundColor: color.tinta,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  burbujaAsistente: {
    alignSelf: "flex-start",
    maxWidth: "90%",
    borderRadius: radio.cta,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  textoUsuario: { fontSize: 14, lineHeight: 21, color: color.papel },
  textoAsistente: { fontSize: 14, lineHeight: 22, color: color.tinta },
  pie: {
    paddingHorizontal: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: color.separador,
    backgroundColor: color.papel,
  },
  filaInput: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    flex: 1,
    height: 44,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 14,
    fontSize: 16,
    color: color.tinta,
  },
  enviar: {
    width: 44,
    height: 44,
    borderRadius: radio.cta,
    backgroundColor: color.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  aviso: {
    marginTop: 6,
    textAlign: "center",
    fontSize: 10.5,
    color: color.tintaTerciaria,
  },
});
