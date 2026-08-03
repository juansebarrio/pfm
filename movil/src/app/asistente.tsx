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
import { Image } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowUp, Camera, ChevronLeft, Images, RotateCcw, X } from "lucide-react-native";
import {
  avisosDe,
  parsearRespuesta,
  repreguntas,
  sinAvisosRepetidos,
  type BloqueAsistente,
} from "@dominio/asistente";
import { hoyBA } from "@dominio/fechas";
import { obtenerSesionHogar, type SesionHogar } from "@/lib/datos";
import { categoriasDelHogar, mediosDePago, type CategoriaSimple, type MedioDePago } from "@/lib/acciones";
import { preguntarAlAsistente, type MensajeChat } from "@/lib/asistente";
import {
  MENSAJE_FALLO,
  elegirDeGaleria,
  sacarFoto,
  type ImagenLista,
} from "@/lib/imagen";
import { color, fuente, radio } from "@/lib/tema";
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
// 3. LEE COMPROBANTES. Se le puede sacar una foto a un ticket o elegir el
//    screenshot de un mail, y lo devuelve como un movimiento para confirmar y
//    cargar. Ver src/componentes/ComprobanteLeido.tsx.
//
// El historial vive en memoria: cerrás la pantalla y se termina. La foto se
// manda SOLO en el turno en que se adjunta: ya leída, no hace falta arrastrarla
// en cada consulta (y sería caro). La imagen no se guarda en ninguna parte.

const MAX_HISTORIAL = 24;

/** El día de hoy en BA. La pantalla no vive lo suficiente para que cambie. */
const HOY = hoyBA();

/** Lo que se ofrece tocar cuando el modelo no propuso repreguntas propias. */
const REPREGUNTAS_BASE = [
  "¿En qué estoy gastando de más?",
  "¿Me conviene pagar el total de la tarjeta?",
];

type Turno = {
  pregunta: string | null; // null = la apertura, que nadie escribió
  /** la foto del comprobante de este turno, si llevaba una */
  miniatura: string | null;
  bloques: BloqueAsistente[];
  crudo: string;
};

export default function Asistente() {
  const router = useRouter();
  const params = useLocalSearchParams<{ camara?: string }>();
  const insets = useSafeAreaInsets();
  const [sesion, setSesion] = useState<SesionHogar | null>(null);
  const [medios, setMedios] = useState<MedioDePago[]>([]);
  const [categorias, setCategorias] = useState<CategoriaSimple[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [borrador, setBorrador] = useState("");
  const [adjunta, setAdjunta] = useState<ImagenLista | null>(null);
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);
  const arrancado = useRef(false);
  const camaraAbierta = useRef(false);

  // medios y categorías se traen al entrar: al confirmar un comprobante no
  // queremos una espera más, y son datos chicos
  useEffect(() => {
    void (async () => {
      const s = await obtenerSesionHogar();
      if (!s) return;
      setSesion(s);
      const [m, c] = await Promise.all([mediosDePago(s), categoriasDelHogar(s)]);
      setMedios(m);
      setCategorias(c);
    })();
  }, []);

  // al desmontar, cortamos el stream en curso
  useEffect(() => () => abortRef.current?.abort(), []);

  const preguntar = useCallback(
    async (texto: string | null, imagen: ImagenLista | null = null) => {
      const limpio = texto?.trim() ?? null;
      // sin texto se puede preguntar solo si hay una foto (o es la apertura)
      if (texto !== null && !limpio && !imagen) return;
      if (pensando) return;

      setError(null);
      setPensando(true);
      setBorrador("");
      setAdjunta(null);

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
        { rol: "usuario" as const, texto: limpio ?? (imagen ? "" : ".") },
      ].slice(-MAX_HISTORIAL);

      setTurnos((prev) => [
        ...prev,
        { pregunta: limpio, miniatura: imagen?.uri ?? null, bloques: [], crudo: "" },
      ]);

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
                bloques: parsearRespuesta(actual, { parcial: true, hoy: HOY }),
              };
              return copia;
            });
          },
          controlador.signal,
          {
            apertura: limpio === null && !imagen,
            imagen: imagen ? { tipo: imagen.tipo, base64: imagen.base64 } : null,
          },
        );
        if (acumulado.trim() === "") throw new Error("");
        // cerrado el stream se re-parsea completo: la última línea ya cuenta
        setTurnos((prev) => {
          const copia = [...prev];
          copia[copia.length - 1] = {
            ...copia[copia.length - 1],
            bloques: parsearRespuesta(acumulado, { hoy: HOY }),
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

  /** Cámara o galería → miniatura lista, o un aviso entendible. */
  async function adjuntar(pedir: () => Promise<Awaited<ReturnType<typeof sacarFoto>>>) {
    setError(null);
    const r = await pedir();
    if (r.ok) {
      setAdjunta(r.imagen);
      tacto.toque();
    } else if (r.motivo !== "cancelado") {
      // cancelar no es un error: el usuario cambió de idea y no hay nada que decir
      setError(MENSAJE_FALLO[r.motivo]);
    }
  }

  // la lectura de apertura, una sola vez
  useEffect(() => {
    if (arrancado.current) return;
    arrancado.current = true;
    void preguntar(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Entrada por la cámara de la pastilla: se abre la cámara sola. La lectura de
  // apertura sigue streameando atrás mientras sacás la foto, así que cuando
  // volvés ya hay algo en pantalla en vez de un blanco.
  useEffect(() => {
    if (params.camara !== "1" || camaraAbierta.current) return;
    camaraAbierta.current = true;
    void adjuntar(sacarFoto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.camara]);

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
            {sesion ? `Al día de hoy, ${sesion.nombreMiembro}` : "Al día de hoy"}
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
            {/* la foto se muestra sola mientras se lee; una vez que llegó el
                comprobante, va DENTRO de la tarjeta de confirmación */}
            {t.miniatura && !t.bloques.some((b) => b.tipo === "comprobante") && (
              <Image source={{ uri: t.miniatura }} style={e.miniatura} resizeMode="contain" />
            )}
            {t.bloques.length === 0 && pensando && i === turnos.length - 1 ? (
              <Text style={e.pensando}>
                {t.miniatura ? "Leyendo el comprobante…" : "Mirando tus números…"}
              </Text>
            ) : (
              <BloquesAsistente
                bloques={sinAvisosRepetidos(
                  t.bloques,
                  turnos.slice(0, i).flatMap((p) => avisosDe(p.bloques)),
                )}
                sesion={sesion}
                medios={medios}
                categorias={categorias}
                hoy={HOY}
                miniatura={t.miniatura}
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
        {/* la foto elegida, antes de mandarla: se puede sacar */}
        {adjunta && (
          <View style={e.adjunto}>
            <Image source={{ uri: adjunta.uri }} style={e.adjuntoMini} />
            <Text style={e.adjuntoTexto}>
              Comprobante listo. Mandalo y te digo qué movimiento cargar.
            </Text>
            <Pressable onPress={() => setAdjunta(null)} hitSlop={12}>
              <X size={17} color={color.tintaSecundaria} strokeWidth={2} />
            </Pressable>
          </View>
        )}

        <View style={e.filaInput}>
          <Pressable
            onPress={() => adjuntar(sacarFoto)}
            disabled={pensando || adjunta !== null}
            style={[e.secundario, (pensando || adjunta !== null) && { opacity: 0.4 }]}
          >
            <Camera size={19} color={color.tinta} strokeWidth={1.6} />
          </Pressable>
          <Pressable
            onPress={() => adjuntar(elegirDeGaleria)}
            disabled={pensando || adjunta !== null}
            style={[e.secundario, (pensando || adjunta !== null) && { opacity: 0.4 }]}
          >
            <Images size={19} color={color.tinta} strokeWidth={1.6} />
          </Pressable>
          <TextInput
            value={borrador}
            onChangeText={setBorrador}
            maxLength={2000}
            placeholder={adjunta ? "Algo que aclarar…" : "Preguntá o mandá un ticket…"}
            placeholderTextColor={color.tintaTerciaria}
            style={e.input}
            onSubmitEditing={() => preguntar(borrador, adjunta)}
            returnKeyType="send"
          />
          <Pressable
            onPress={() => preguntar(borrador, adjunta)}
            disabled={(borrador.trim() === "" && !adjunta) || pensando}
            style={[
              e.enviar,
              ((borrador.trim() === "" && !adjunta) || pensando) && { opacity: 0.5 },
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
          {"\n"}Las fotos se leen y se descartan: no se guardan.
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
  titulo: { fontSize: 17, fontFamily: fuente.textoSemi, color: color.tinta },
  subtitulo: { fontSize: 11.5, fontFamily: fuente.texto, color: color.tintaSecundaria },
  pregunta: {
    fontSize: 12.5,
    fontFamily: fuente.textoSemi,
    color: color.tintaSecundaria,
    textTransform: "none",
  },
  pensando: { fontSize: 13.5, fontFamily: fuente.texto, color: color.tintaTerciaria },
  error: { fontSize: 12.5, fontFamily: fuente.textoMedio, color: color.rojo },
  sugerencias: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: radio.chip,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  chipTexto: { fontSize: 12.5, fontFamily: fuente.texto, color: color.tinta },
  pie: {
    paddingHorizontal: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: color.separador,
    backgroundColor: color.papel,
  },
  miniatura: {
    height: 120,
    width: "60%",
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
  },
  adjunto: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    padding: 8,
  },
  adjuntoMini: { width: 46, height: 46, borderRadius: 8, backgroundColor: color.papel },
  adjuntoTexto: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
  filaInput: { flexDirection: "row", alignItems: "center", gap: 7 },
  secundario: {
    width: 42,
    height: 44,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: fuente.texto,
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
    lineHeight: 15,
    fontFamily: fuente.texto,
    color: color.tintaTerciaria,
  },
});
