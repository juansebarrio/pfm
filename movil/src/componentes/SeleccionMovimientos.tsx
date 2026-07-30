import { Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { CalendarArrowDown, Check, X } from "lucide-react-native";
import { color, radio } from "@/lib/tema";
import { tacto } from "@/lib/tacto";
import { aISO, desdeISO } from "@/lib/fecha-local";
import { FilaMovimiento, type DatosFilaMovimiento } from "@/componentes/sistema";

// Modo selección del historial: elegís varios movimientos y les cambiás la
// fecha de una. Espeja BarraSeleccion.tsx y FilaSeleccionable.tsx de la web.

/**
 * La misma fila del historial pero con casilla, y el tap alterna en vez de
 * abrir el detalle. Es un componente aparte de FilaSwipe y no un modo suyo: el
 * swipe nativo lo maneja el gesture handler en el hilo de UI, y meterle un
 * "ahora no arrastres" era la forma más fácil de romper el borrado sin darse
 * cuenta. Acá el gesto directamente no existe.
 *
 * Las CUOTAS no se pueden elegir: su fecha la manda la serie de la compra. Se
 * ven apagadas y sin casilla — el badge "Cuota 2/6" ya explica por qué.
 */
export function FilaSeleccionable({
  datos,
  elegido,
  seleccionable,
  alAlternar,
}: {
  datos: DatosFilaMovimiento;
  elegido: boolean;
  seleccionable: boolean;
  alAlternar: () => void;
}) {
  if (!seleccionable) {
    return (
      <View style={[e.fila, { opacity: 0.4 }]}>
        <View style={[e.casilla, e.casillaBloqueada]} />
        <View style={{ flex: 1 }}>
          <FilaMovimiento {...datos} />
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => {
        tacto.toque();
        alAlternar();
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: elegido }}
      style={e.fila}
    >
      <View style={[e.casilla, elegido && e.casillaElegida]}>
        {elegido && <Check size={15} color={color.papel} strokeWidth={3} />}
      </View>
      <View style={{ flex: 1 }}>
        <FilaMovimiento {...datos} />
      </View>
    </Pressable>
  );
}

/**
 * Barra de acción: cuántos elegiste y a qué fecha moverlos. Va fija abajo y
 * tapando la tab bar a propósito: mientras seleccionás estás en un modo, y
 * ofrecer "Patrimonio" al lado de "Mover 3" invita a perder la selección.
 */
export function BarraSeleccion({
  cantidad,
  fecha,
  pendiente,
  abajo,
  alElegirFecha,
  alMover,
  alCancelar,
}: {
  cantidad: number;
  fecha: string;
  pendiente: boolean;
  /** safe area inferior */
  abajo: number;
  alElegirFecha: (f: string) => void;
  alMover: () => void;
  alCancelar: () => void;
}) {
  const listo = cantidad > 0 && !pendiente;
  return (
    <View style={[e.barra, { paddingBottom: Math.max(20, abajo) }]}>
      <View style={e.barraFila}>
        <Text style={e.cuenta}>
          {cantidad === 0
            ? "Elegí movimientos para mover"
            : `${cantidad} ${cantidad === 1 ? "elegido" : "elegidos"}`}
        </Text>
        <Pressable onPress={alCancelar} hitSlop={10} style={e.cancelar}>
          <X size={16} color={color.tintaSecundaria} strokeWidth={2} />
          <Text style={e.cancelarTexto}>Cancelar</Text>
        </Pressable>
      </View>

      <View style={e.barraAccion}>
        <View style={e.cajaFecha}>
          <DateTimePicker
            mode="date"
            display="compact"
            value={desdeISO(fecha)}
            onChange={(_evento, elegida) => elegida && alElegirFecha(aISO(elegida))}
            themeVariant="dark"
            accentColor={color.verde}
          />
        </View>
        <Pressable
          onPress={alMover}
          disabled={!listo}
          style={[e.cta, !listo && { opacity: 0.4 }]}
        >
          <CalendarArrowDown size={17} color={color.papel} strokeWidth={2} />
          <Text style={e.ctaTexto}>{pendiente ? "Moviendo…" : "Mover"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const e = StyleSheet.create({
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 12,
    backgroundColor: color.superficie,
  },
  casilla: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.papel,
    alignItems: "center",
    justifyContent: "center",
  },
  casillaElegida: { borderColor: color.verde, backgroundColor: color.verde },
  casillaBloqueada: { borderStyle: "dashed" },
  barra: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: color.borde,
    backgroundColor: color.papel,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  barraFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cuenta: { fontSize: 13.5, fontWeight: "600", color: color.tinta },
  cancelar: { flexDirection: "row", alignItems: "center", gap: 4 },
  cancelarTexto: { fontSize: 13, fontWeight: "500", color: color.tintaSecundaria },
  barraAccion: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  cajaFecha: { flex: 1, justifyContent: "center" },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: radio.cta,
    backgroundColor: color.verde,
  },
  ctaTexto: { fontSize: 14, fontWeight: "600", color: color.papel },
});
