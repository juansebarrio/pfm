import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, Pencil, Trash2 } from "lucide-react-native";
import { formatearImporte } from "@dominio/dinero";
import { formatearDiaCorto, formatearDiaLargo } from "@dominio/fechas";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  actualizarFecha,
  actualizarMovimiento,
  actualizarNota,
  type CategoriaSimple,
  type MedioDePago,
} from "@/lib/acciones";
import { GRUPO_INGRESOS } from "@dominio/categorias";
import { centavosDesdeTexto } from "@dominio/dinero";
import { aISO, desdeISO } from "@/lib/fecha-local";
import type { MovimientoFila, SesionHogar } from "@/lib/datos";
import { color, radio } from "@/lib/tema";
import { tacto } from "@/lib/tacto";
import { Badge, IconoCategoria } from "@/componentes/sistema";

// Detalle de un movimiento en hoja inferior. Espeja
// app/(tabs)/movimientos/DetalleMovimiento.tsx: muestra todo lo que hay, deja
// editar el comentario y ofrece el borrado; si es una cuota, avisa que borra
// la compra entera.

const NOMBRE_TIPO: Record<MovimientoFila["tipo"], string | null> = {
  gasto: null, // es lo esperado, no hace falta rotularlo
  ingreso: "Ingreso",
  transferencia: "Transferencia",
  pago_resumen: "Pago de resumen",
};

const DURACION_MS = 280;

/**
 * "Cargado por": en un hogar de dos, "¿esto lo cargaste vos o yo?" no tenía
 * respuesta en ningún lado. El nombre solo no alcanza — que diga cuál de los
 * dos sos vos es la mitad del dato —, así que el propio se marca. En un hogar
 * de a uno la capa de datos manda null y la fila no aparece. Espeja
 * app/(tabs)/movimientos/DetalleMovimiento.tsx.
 */
function etiquetaCargadoPor(m: MovimientoFila): string | null {
  if (m.cargadoPor === null) return null;
  return m.esPropio ? `${m.cargadoPor} · vos` : m.cargadoPor;
}

export function DetalleMovimiento({
  movimiento,
  sesion,
  categorias = [],
  medios = [],
  alCerrar,
  alBorrar,
  alCambiar,
}: {
  movimiento: MovimientoFila | null;
  sesion: SesionHogar | null;
  /** para el formulario de edición; sin ellos, el botón Editar no aparece */
  categorias?: CategoriaSimple[];
  medios?: MedioDePago[];
  alCerrar: () => void;
  alBorrar: () => void;
  /** algo cambió (p. ej. la fecha): la lista de atrás tiene que recargar */
  alCambiar?: () => void;
}) {
  const insets = useSafeAreaInsets();

  // La animación es propia y no el animationType del Modal: con "slide" y
  // fondo transparente, el FONDO OSCURO sube junto con la hoja y el conjunto
  // aparece de un golpe. Acá el fondo hace fade mientras la hoja sube, que es
  // como se comporta una hoja de verdad en iOS. El Modal guarda una copia del
  // movimiento para poder animar la SALIDA: si renderizara `movimiento`
  // directo, al ponerse en null la hoja desaparecería antes de bajar.
  const [copia, setCopia] = useState<MovimientoFila | null>(null);
  const progreso = useRef(new Animated.Value(0)).current;
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    if (movimiento !== null) {
      setCopia(movimiento);
      setEditando(false);
      Animated.timing(progreso, {
        toValue: 1,
        duration: DURACION_MS,
        easing: Easing.bezier(0.32, 0.72, 0.28, 1),
        useNativeDriver: true,
      }).start();
    } else if (copia !== null) {
      Animated.timing(progreso, {
        toValue: 0,
        duration: DURACION_MS - 60,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setCopia(null);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movimiento]);

  const m = movimiento ?? copia;
  const cargadoPor = m ? etiquetaCargadoPor(m) : null;
  const editable =
    m !== null && (m.tipo === "gasto" || m.tipo === "ingreso") &&
    categorias.length > 0 && medios.length > 0;

  return (
    <Modal
      visible={m !== null}
      animationType="none"
      transparent
      onRequestClose={alCerrar}
    >
      <Animated.View style={[e.fondo, { opacity: progreso }]}>
        <Pressable style={{ flex: 1 }} onPress={alCerrar} />
      </Animated.View>
      <Animated.View
        style={[
          e.hoja,
          { paddingBottom: Math.max(20, insets.bottom) },
          {
            transform: [
              {
                translateY: progreso.interpolate({
                  inputRange: [0, 1],
                  outputRange: [560, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={e.agarre} />
        {m && editando ? (
          <FormularioEdicion
            key={m.id}
            movimiento={m}
            sesion={sesion}
            categorias={categorias}
            medios={medios}
            alListo={() => {
              setEditando(false);
              alCambiar?.();
              alCerrar();
            }}
            alCancelar={() => setEditando(false)}
          />
        ) : m ? (
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={{ alignItems: "center" }}>
              <Text style={[e.importe, m.esIngreso && { color: color.verde }]}>
                {m.esIngreso ? "+ " : ""}
                {formatearImporte(m.importeCentavos)}
              </Text>
              <Text style={e.descripcion}>{m.descripcion}</Text>
            </View>

            <View style={e.tabla}>
              <Fila etiqueta="Categoría">
                {m.categoria ? (
                  <View style={e.valorConIcono}>
                    <IconoCategoria nombre={m.icono} />
                    <Text style={e.valor}>{m.categoria}</Text>
                  </View>
                ) : (
                  <Text style={e.valorApagado}>Sin categorizar</Text>
                )}
              </Fila>
              {m.medio && (
                <Fila etiqueta="Medio" conBorde>
                  <Text style={e.valor}>{m.medio}</Text>
                </Fila>
              )}
              <Fila etiqueta="Fecha" conBorde>
                {m.badgeCuota ? (
                  <Text style={e.valor}>{formatearDiaLargo(m.fecha)}</Text>
                ) : (
                  <EditorFecha
                    key={m.id}
                    sesion={sesion}
                    movimientoId={m.id}
                    fechaInicial={m.fecha}
                    alCambiar={alCambiar}
                  />
                )}
              </Fila>
              <Fila etiqueta="Ámbito" conBorde>
                <Badge variante={m.ambito === "hogar" ? "hogar" : "personal"}>
                  {m.ambito}
                </Badge>
              </Fila>
              {cargadoPor && (
                <Fila etiqueta="Cargado por" conBorde>
                  <Text style={e.valor}>{cargadoPor}</Text>
                </Fila>
              )}
              {/* a qué resumen de la tarjeta cae el consumo, mientras el ciclo
                  siga abierto — espejo de la fila "Ciclo" de la web, más el
                  estado cuando la fecha de cierre es estimada */}
              {m.cierreCiclo && (
                <Fila etiqueta="Ciclo" conBorde>
                  <Text style={[e.valor, { color: color.ambarTexto }]}>
                    {`cierra ${formatearDiaCorto(m.cierreCiclo.fechaCierre)}${
                      m.cierreCiclo.estado === "estimado" ? " · estimado" : ""
                    }`}
                  </Text>
                </Fila>
              )}
              {m.badgeCuota && (
                <Fila etiqueta="Cuota" conBorde>
                  <Badge variante="cuota">{m.badgeCuota}</Badge>
                </Fila>
              )}
              {NOMBRE_TIPO[m.tipo] && (
                <Fila etiqueta="Tipo" conBorde>
                  <Text style={e.valor}>{NOMBRE_TIPO[m.tipo]}</Text>
                </Fila>
              )}
            </View>

            {/* key por movimiento: resetea el borrador al abrir otro */}
            <EditorNota
              key={m.id}
              sesion={sesion}
              movimientoId={m.id}
              notaInicial={m.nota}
            />

            {m.badgeCuota && (
              <Text style={e.avisoCuota}>
                Es una cuota de una compra. Borrar acá elimina la compra completa
                {m.nCuotasTotal ? ` (${m.nCuotasTotal} cuotas)` : ""}.
              </Text>
            )}

            {editable && (
              <Pressable
                onPress={() => {
                  tacto.toque();
                  setEditando(true);
                }}
                style={e.editar}
              >
                <Pencil size={16} color={color.papel} strokeWidth={1.8} />
                <Text style={e.editarTexto}>
                  {m.badgeCuota ? "Editar la compra" : "Editar movimiento"}
                </Text>
              </Pressable>
            )}

            <Pressable onPress={alBorrar} style={e.borrar}>
              <Trash2 size={16} color={color.rojo} strokeWidth={1.8} />
              <Text style={e.borrarTexto}>
                {m.badgeCuota && m.nCuotasTotal
                  ? `Borrar la compra · ${m.nCuotasTotal} cuotas`
                  : "Borrar movimiento"}
              </Text>
            </Pressable>
          </ScrollView>
        ) : null}
      </Animated.View>
    </Modal>
  );
}

/**
 * El formulario de edición, dentro de la hoja. Espeja el de la web: mismos
 * controles que la confirmación de un comprobante, porque es la misma tarea.
 */
function FormularioEdicion({
  movimiento: m,
  sesion,
  categorias,
  medios,
  alListo,
  alCancelar,
}: {
  movimiento: MovimientoFila;
  sesion: SesionHogar | null;
  categorias: CategoriaSimple[];
  medios: MedioDePago[];
  alListo: () => void;
  alCancelar: () => void;
}) {
  const esIngreso = m.tipo === "ingreso";
  const [descripcion, setDescripcion] = useState(m.descripcion);
  const [montoTexto, setMontoTexto] = useState(formatearImporte(m.importeCentavos));
  const [categoriaId, setCategoriaId] = useState<string | null>(m.categoriaId);
  const [medioId, setMedioId] = useState<string | null>(m.medioId);
  const [ambito, setAmbito] = useState<"hogar" | "personal">(m.ambito);
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const montoCentavos = centavosDesdeTexto(montoTexto);
  const mediosPosibles = esIngreso ? medios.filter((x) => x.tipo === "cuenta") : medios;
  const medio = mediosPosibles.find((x) => x.id === medioId) ?? null;
  const deEsteAmbito = categorias.filter(
    (c) => c.ambito === ambito && (c.grupo === GRUPO_INGRESOS) === esIngreso,
  );
  const listo =
    descripcion.trim() !== "" && montoCentavos !== null && montoCentavos > 0 && medio !== null;

  async function guardar() {
    if (!listo || pendiente || !sesion || !medio || montoCentavos === null) return;
    setPendiente(true);
    setError(null);
    const r = await actualizarMovimiento(sesion, {
      movimientoId: m.id,
      descripcion: descripcion.trim(),
      importeCentavos: montoCentavos,
      categoriaId: deEsteAmbito.some((c) => c.id === categoriaId) ? categoriaId : null,
      medioTipo: medio.tipo,
      medioId: medio.id,
      ambito,
    });
    setPendiente(false);
    if (r.ok) {
      tacto.guardado();
      alListo();
    } else {
      setError(r.error);
    }
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <TextInput
        value={descripcion}
        onChangeText={setDescripcion}
        maxLength={80}
        placeholder="Comercio o concepto"
        placeholderTextColor={color.tintaTerciaria}
        style={f.inputDescripcion}
      />
      <TextInput
        value={montoTexto}
        onChangeText={setMontoTexto}
        editable={!m.esCuota}
        keyboardType="numbers-and-punctuation"
        placeholderTextColor={color.tintaTerciaria}
        style={[f.inputMonto, m.esCuota && { opacity: 0.5 }]}
      />

      {!m.esCuota && (
        <>
          <Text style={f.etiqueta}>{esIngreso ? "Entra a" : "Se pagó con"}</Text>
          <View style={f.chips}>
            {mediosPosibles.map((x) => (
              <Pressable
                key={x.id}
                onPress={() => {
                  tacto.toque();
                  setMedioId(x.id);
                }}
                style={[f.chip, medioId === x.id && f.chipActivo]}
              >
                <Text style={[f.chipTexto, medioId === x.id && f.chipTextoActivo]}>
                  {x.etiqueta}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Text style={f.etiqueta}>Ámbito</Text>
      <View style={f.chips}>
        {(["hogar", "personal"] as const).map((a) => (
          <Pressable
            key={a}
            onPress={() => {
              tacto.toque();
              setAmbito(a);
              setCategoriaId(null); // las categorías son por ámbito
            }}
            style={[f.chip, ambito === a && f.chipActivo]}
          >
            <Text style={[f.chipTexto, ambito === a && f.chipTextoActivo]}>
              {a === "hogar" ? "Del hogar" : "Solo mío"}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={f.etiqueta}>Categoría</Text>
      <View style={f.chips}>
        {deEsteAmbito.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => {
              tacto.toque();
              setCategoriaId(categoriaId === c.id ? null : c.id);
            }}
            style={[f.chip, categoriaId === c.id && f.chipActivo]}
          >
            <IconoCategoria nombre={c.icono} tamano={13} tono={categoriaId === c.id ? "verde" : "normal"} />
            <Text style={[f.chipTexto, categoriaId === c.id && f.chipTextoActivo]}>
              {c.nombre}
            </Text>
          </Pressable>
        ))}
      </View>
      {categoriaId === null && (
        <Text style={f.nota}>Sin categoría vuelve a la bandeja de entrada.</Text>
      )}

      {m.esCuota && (
        <Text style={f.nota}>
          Es una cuota: el importe y el medio los maneja la compra. Lo que cambies
          acá se aplica a las {m.nCuotasTotal ?? ""} cuotas.
        </Text>
      )}

      {error && <Text style={f.error}>{error}</Text>}

      <View style={f.acciones}>
        <Pressable
          onPress={guardar}
          disabled={!listo || pendiente}
          style={[f.cta, (!listo || pendiente) && { opacity: 0.4 }]}
        >
          <Check size={17} color={color.papel} strokeWidth={2.2} />
          <Text style={f.ctaTexto}>{pendiente ? "Guardando…" : "Guardar cambios"}</Text>
        </Pressable>
        <Pressable onPress={alCancelar} disabled={pendiente} hitSlop={10}>
          <Text style={f.cancelar}>Cancelar</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const f = StyleSheet.create({
  inputDescripcion: {
    height: 44,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: "500",
    color: color.tinta,
  },
  inputMonto: {
    marginTop: 10,
    height: 56,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 14,
    fontSize: 26,
    fontWeight: "600",
    color: color.tinta,
  },
  etiqueta: { marginTop: 14, fontSize: 11.5, color: color.tintaSecundaria },
  chips: { marginTop: 6, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: radio.chip,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipActivo: { borderWidth: 1.5, borderColor: color.verde, backgroundColor: color.verdeSuave },
  chipTexto: { fontSize: 12, color: color.tinta },
  chipTextoActivo: { fontWeight: "600" },
  nota: { marginTop: 10, fontSize: 11.5, lineHeight: 18, color: color.tintaSecundaria },
  error: { marginTop: 10, fontSize: 12.5, fontWeight: "500", color: color.rojo },
  acciones: { marginTop: 16, flexDirection: "row", alignItems: "center", gap: 10 },
  cta: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderRadius: radio.cta,
    backgroundColor: color.verde,
  },
  ctaTexto: { fontSize: 14, fontWeight: "600", color: color.papel },
  cancelar: { fontSize: 13, fontWeight: "500", color: color.tintaSecundaria, paddingHorizontal: 6 },
});

function Fila({
  etiqueta,
  conBorde,
  children,
}: {
  etiqueta: string;
  conBorde?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[e.fila, conBorde && e.filaConBorde]}>
      <Text style={e.etiqueta}>{etiqueta}</Text>
      <View style={{ flexShrink: 1 }}>{children}</View>
    </View>
  );
}

/**
 * La fecha se edita acá mismo y se guarda al elegirla — cambiarla a otro mes es
 * "arrastrar" el movimiento. Si es de tarjeta, la acción reasigna el ciclo.
 */
function EditorFecha({
  sesion,
  movimientoId,
  fechaInicial,
  alCambiar,
}: {
  sesion: SesionHogar | null;
  movimientoId: string;
  fechaInicial: string;
  alCambiar?: () => void;
}) {
  const [fecha, setFecha] = useState(fechaInicial);

  async function guardar(elegida: Date) {
    const nueva = aISO(elegida);
    if (!sesion || nueva === fecha) return;
    const anterior = fecha;
    setFecha(nueva); // optimista
    const r = await actualizarFecha(sesion, movimientoId, nueva);
    if (r.ok) {
      tacto.guardado();
      alCambiar?.();
    } else {
      setFecha(anterior);
      tacto.error();
      Alert.alert("No pudimos cambiar la fecha", r.error);
    }
  }

  return (
    <DateTimePicker
      mode="date"
      display="compact"
      value={desdeISO(fecha)}
      onChange={(_evento, elegida) => elegida && guardar(elegida)}
      themeVariant="dark"
      accentColor={color.verde}
    />
  );
}

/** El botón de guardar aparece solo cuando el texto difiere de lo guardado. */
function EditorNota({
  sesion,
  movimientoId,
  notaInicial,
}: {
  sesion: SesionHogar | null;
  movimientoId: string;
  notaInicial: string | null;
}) {
  const [texto, setTexto] = useState(notaInicial ?? "");
  const [pendiente, setPendiente] = useState(false);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    if (!guardado) return;
    const t = setTimeout(() => setGuardado(false), 2000);
    return () => clearTimeout(t);
  }, [guardado]);

  const cambio = texto.trim() !== (notaInicial ?? "").trim();

  async function guardar() {
    if (!sesion || pendiente) return;
    setPendiente(true);
    const r = await actualizarNota(sesion, movimientoId, texto);
    setPendiente(false);
    if (r.ok) {
      tacto.guardado();
      setGuardado(true);
    } else {
      tacto.error();
    }
  }

  return (
    <View style={{ marginTop: 16 }}>
      <Text style={e.etiquetaNota}>Comentario</Text>
      <TextInput
        value={texto}
        onChangeText={setTexto}
        maxLength={200}
        placeholder="Sin comentario"
        placeholderTextColor={color.tintaTerciaria}
        style={e.inputNota}
      />
      {cambio && (
        <Pressable onPress={guardar} disabled={pendiente} style={e.guardarNota}>
          {pendiente ? (
            <ActivityIndicator size="small" color={color.papel} />
          ) : (
            <Text style={e.guardarNotaTexto}>Guardar</Text>
          )}
        </Pressable>
      )}
      {guardado && !cambio && <Text style={e.guardadoOk}>Guardado ✓</Text>}
    </View>
  );
}

const e = StyleSheet.create({
  fondo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  hoja: {
    marginTop: "auto",
    maxHeight: "85%",
    backgroundColor: color.papel,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  agarre: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.borde,
    marginBottom: 16,
  },
  importe: { fontSize: 30, fontWeight: "600", color: color.tinta },
  descripcion: { marginTop: 4, fontSize: 15, fontWeight: "500", color: color.tinta },
  tabla: {
    marginTop: 16,
    borderRadius: radio.card,
    borderWidth: 1,
    borderColor: color.borde,
  },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  filaConBorde: { borderTopWidth: 1, borderTopColor: color.separador },
  etiqueta: { fontSize: 12.5, color: color.tintaSecundaria },
  valor: { fontSize: 13.5, fontWeight: "500", color: color.tinta },
  valorApagado: { fontSize: 13.5, color: color.tintaSecundaria },
  valorConIcono: { flexDirection: "row", alignItems: "center", gap: 6 },
  etiquetaNota: { fontSize: 12, color: color.tintaSecundaria },
  inputNota: {
    marginTop: 6,
    height: 44,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 14,
    fontSize: 15,
    color: color.tinta,
  },
  guardarNota: {
    marginTop: 8,
    alignSelf: "flex-end",
    borderRadius: radio.chipChico,
    backgroundColor: color.verde,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  guardarNotaTexto: { fontSize: 13, fontWeight: "600", color: color.papel },
  guardadoOk: { marginTop: 8, alignSelf: "flex-end", fontSize: 12, color: color.verde },
  avisoCuota: {
    marginTop: 10,
    fontSize: 11.5,
    lineHeight: 17,
    color: color.tintaSecundaria,
  },
  editar: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radio.cta,
    backgroundColor: color.verde,
  },
  editarTexto: { fontSize: 14, fontWeight: "600", color: color.papel },
  borrar: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.rojo,
    paddingVertical: 14,
  },
  borrarTexto: { fontSize: 14, fontWeight: "600", color: color.rojo },
});
