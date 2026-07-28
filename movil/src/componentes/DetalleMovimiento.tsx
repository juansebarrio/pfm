import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Trash2 } from "lucide-react-native";
import { formatearImporte } from "@dominio/dinero";
import { formatearDiaLargo } from "@dominio/fechas";
import DateTimePicker from "@react-native-community/datetimepicker";
import { actualizarFecha, actualizarNota } from "@/lib/acciones";
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

export function DetalleMovimiento({
  movimiento,
  sesion,
  alCerrar,
  alBorrar,
  alCambiar,
}: {
  movimiento: MovimientoFila | null;
  sesion: SesionHogar | null;
  alCerrar: () => void;
  alBorrar: () => void;
  /** algo cambió (p. ej. la fecha): la lista de atrás tiene que recargar */
  alCambiar?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const m = movimiento;

  return (
    <Modal
      visible={m !== null}
      animationType="slide"
      transparent
      onRequestClose={alCerrar}
    >
      <Pressable style={e.fondo} onPress={alCerrar} />
      <View style={[e.hoja, { paddingBottom: Math.max(20, insets.bottom) }]}>
        <View style={e.agarre} />
        {m && (
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

            <Pressable onPress={alBorrar} style={e.borrar}>
              <Trash2 size={16} color={color.rojo} strokeWidth={1.8} />
              <Text style={e.borrarTexto}>
                {m.badgeCuota && m.nCuotasTotal
                  ? `Borrar la compra · ${m.nCuotasTotal} cuotas`
                  : "Borrar movimiento"}
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

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
  fondo: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  hoja: {
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
