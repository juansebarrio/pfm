import { useCallback, useEffect, useRef, useState } from "react";
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
import { ArrowUp, ChevronLeft, RotateCcw } from "lucide-react-native";
import {
  avisosDe,
  parsearRespuesta,
  repreguntas,
  sinAvisosRepetidos,
  type BloqueAsistente,
} from "@dominio/asistente";
import { obtenerSesionHogar } from "@/lib/datos";
import { preguntarAlAsistente, type MensajeChat } from "@/lib/asistente";
import { color, radio } from "@/lib/tema";
import { tacto } from "@/lib/tacto";
import { BloquesAsistente } from "@/componentes/BloquesAsistente";

// Asistente financiero.
//
// A propósito NO es un chat genérico. Dos decisiones que lo separan:
//
// 1. ABRE ÉL. Al entrar no hay pantalla en blanco ni "¿en qué te ayudo?": el
//    asistente ya tiene tus números, así que arranca leyéndolos. La pregunta
//    de apertura la pone el server (no viaja un mensaje falso del usuario) y
//    por eso no se dibuja ninguna burbuja para ella.
//
// 2. NO ESCRIBE PÁRRAFOS, COMPONE LA APP. Las respuestas traen marcadores que
//    se renderizan con los componentes reales — la cifra grande del Resumen,
//    la barra del Presupuesto. Ver lib/dominio/asistente.ts.
//
// El historial vive en memoria: cerrás la pantalla y se termina.

const MAX_HISTORIAL = 24;

/** Lo que se ofrece tocar cuando el modelo no propuso repreguntas propias. */
const REPREGUNTAS_BASE = [
  "¿En qué estoy gastando de más?",
  "¿Me conviene pagar el total de la tarjeta?",
];

type Turno = {
  pregunta: string | null; // null = la apertura, que nadie escribió
  bloques: BloqueAsistente[];
  crudo: string;
};

export default function Asistente() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [nombre, setNombre] = useState("");
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [borrador, setBorrador] = useState("");
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);
  const arrancado = useRef(false);

  useEffect(() => {
    obtenerSesionHogar().then((s) => s && setNombre(s.nombreMiembro));
  }, []);

  // al desmontar, cortamos el stream en curso
  useEffect(() => () => abortRef.current?.abort(), []);

  const preguntar = useCallback(
    async (texto: string | null) => {
      const limpio = texto?.trim() ?? null;
      if ((texto !== null && !limpio) || pensando) return;

      setError(null);
      setPensando(true);
      setBorrador("");

      // El server necesita SIEMPRE un último mensaje de usuario; en la apertura
      // lo reemplaza por su propio pedido, así que acá va un marcador cualquiera.
      const historial: MensajeChat[] = [
        ...turnos.flatMap((t): MensajeChat[] =>
          t.pregunta === null
            ? [{ rol: "asistente", texto: t.crudo }]
            : [
                { rol: "usuario", texto: t.pregunta },
                { rol: "asistente", texto: t.crudo },
              ],
        ),
        { rol: "usuario" as const, texto: limpio ?? "." },
      ].slice(-MAX_HISTORIAL);

      setTurnos((prev) => [...prev, { pregunta: limpio, bloques: [], crudo: "" }]);

      const controlador = new AbortController();
      abortRef.current = controlador;

      let acumulado = "";
      try {
        await preguntarAlAsistente(
          historial,
          (pedazo) => {
            acumulado += pedazo;
            const actual = acumulado;
            setTurnos((prev) => {
              const copia = [...prev];
              copia[copia.length - 1] = {
                ...copia[copia.length - 1],
                crudo: actual,
                bloques: parsearRespuesta(actual, { parcial: true }),
              };
              return copia;
            });
          },
          controlador.signal,
          { apertura: limpio === null },
        );
        if (acumulado.trim() === "") throw new Error("");
        // cerrado el stream se re-parsea completo: la última línea ya cuenta
        setTurnos((prev) => {
          const copia = [...prev];
          copia[copia.length - 1] = {
            ...copia[copia.length - 1],
            bloques: parsearRespuesta(acumulado),
          };
          return copia;
        });
        tacto.toque();
      } catch (e) {
        if (controlador.signal.aborted) return;
        const detalle = e instanceof Error ? e.message : "";
        setError(detalle || "No pude responder. Fijate la conexión y probá de nuevo.");
        // el turno sin respuesta se descarta: no dejamos una burbuja vacía
        setTurnos((prev) => prev.slice(0, -1));
      } finally {
        setPensando(false);
      }
    },
    [pensando, turnos],
  );

  // la lectura de apertura, una sola vez
  useEffect(() => {
    if (arrancado.current) return;
    arrancado.current = true;
    void preguntar(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ultimo = turnos[turnos.length - 1];
  const sugerencias =
    !pensando && ultimo ? repreguntas(ultimo.bloques) : [];
  const aOfrecer = sugerencias.length > 0 ? sugerencias : !pensando && ultimo ? REPREGUNTAS_BASE : [];

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
          <Text style={e.titulo}>Tus números</Text>
          <Text style={e.subtitulo}>
            {nombre ? `Al día de hoy, ${nombre}` : "Al día de hoy"}
          </Text>
        </View>
        {turnos.length > 1 && !pensando && (
          <Pressable
            onPress={() => {
              setTurnos([]);
              arrancado.current = false;
              void preguntar(null);
            }}
            hitSlop={10}
          >
            <RotateCcw size={17} color={color.tintaSecundaria} strokeWidth={1.5} />
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, gap: 18 }}
        keyboardShouldPersistTaps="handled"
      >
        {turnos.map((t, i) => (
          <View key={i} style={{ gap: 10 }}>
            {/* la pregunta va como un encabezado tenue, no como burbuja: lo que
                importa es la respuesta, no el ida y vuelta */}
            {t.pregunta && <Text style={e.pregunta}>{t.pregunta}</Text>}
            {t.bloques.length === 0 && pensando && i === turnos.length - 1 ? (
              <Text style={e.pensando}>Mirando tus números…</Text>
            ) : (
              <BloquesAsistente
                bloques={sinAvisosRepetidos(
                  t.bloques,
                  turnos.slice(0, i).flatMap((p) => avisosDe(p.bloques)),
                )}
              />
            )}
          </View>
        ))}

        {error && <Text style={e.error}>{error}</Text>}

        {aOfrecer.length > 0 && (
          <View style={e.sugerencias}>
            {aOfrecer.map((s) => (
              <Pressable key={s} onPress={() => preguntar(s)} style={e.chip}>
                <Text style={e.chipTexto}>{s}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={[e.pie, { paddingBottom: Math.max(14, insets.bottom) }]}>
        <View style={e.filaInput}>
          <TextInput
            value={borrador}
            onChangeText={setBorrador}
            maxLength={2000}
            placeholder="Preguntá lo que quieras…"
            placeholderTextColor={color.tintaTerciaria}
            style={e.input}
            onSubmitEditing={() => preguntar(borrador)}
            returnKeyType="send"
          />
          <Pressable
            onPress={() => preguntar(borrador)}
            disabled={borrador.trim() === "" || pensando}
            style={[e.enviar, (borrador.trim() === "" || pensando) && { opacity: 0.5 }]}
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
    paddingBottom: 14,
  },
  titulo: { fontSize: 17, fontWeight: "600", color: color.tinta },
  subtitulo: { fontSize: 11.5, color: color.tintaSecundaria },
  pregunta: {
    fontSize: 12.5,
    fontWeight: "600",
    color: color.tintaSecundaria,
    textTransform: "none",
  },
  pensando: { fontSize: 13.5, color: color.tintaTerciaria },
  error: { fontSize: 12.5, fontWeight: "500", color: color.rojo },
  sugerencias: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: radio.chip,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  chipTexto: { fontSize: 12.5, color: color.tinta },
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
