import { useRef } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { Trash2 } from "lucide-react-native";
import { color } from "@/lib/tema";
import { tacto } from "@/lib/tacto";
import { FilaMovimiento, type DatosFilaMovimiento } from "@/componentes/sistema";

// Espeja app/(tabs)/movimientos/FilaSwipe.tsx, pero acá el gesto es de verdad:
// la web lo emula con pointer events y transform: en nativo lo maneja el
// gesture handler en el hilo de UI, así que el arrastre sigue al dedo aunque
// el hilo de JS esté ocupado. Es exactamente lo que la PWA no puede dar.

const ANCHO_BORRAR = 92;

type Props = {
  datos: DatosFilaMovimiento;
  etiquetaBorrar: string; // "Borrar" | "Borrar compra"
  alBorrar: () => void;
  /** tap en el cuerpo → abre el detalle */
  alTocar: () => void;
};

export function FilaSwipe({ datos, etiquetaBorrar, alBorrar, alTocar }: Props) {
  const ref = useRef<SwipeableMethods>(null);

  function confirmar() {
    // borrar plata no se deshace: siempre se pregunta
    Alert.alert(etiquetaBorrar, "Esto no se puede deshacer.", [
      { text: "Cancelar", style: "cancel", onPress: () => ref.current?.close() },
      {
        text: "Borrar",
        style: "destructive",
        onPress: () => {
          tacto.guardado();
          alBorrar();
        },
      },
    ]);
  }

  function panel(_progreso: SharedValue<number>, arrastre: SharedValue<number>) {
    return (
      <Accion arrastre={arrastre} etiqueta={etiquetaBorrar} alTocar={confirmar} />
    );
  }

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={panel}
      containerStyle={{ backgroundColor: color.rojo }}
    >
      {/* El Pressable va DENTRO del Swipeable: el gesture handler ya decide si
          el gesto es un arrastre, y en ese caso cancela el press. */}
      <Pressable onPress={alTocar} style={{ backgroundColor: color.superficie }}>
        <FilaMovimiento {...datos} />
      </Pressable>
    </ReanimatedSwipeable>
  );
}

/** El panel rojo de atrás: acompaña al arrastre en vez de aparecer de golpe. */
function Accion({
  arrastre,
  etiqueta,
  alTocar,
}: {
  arrastre: SharedValue<number>;
  etiqueta: string;
  alTocar: () => void;
}) {
  const estilo = useAnimatedStyle(() => ({
    transform: [{ translateX: arrastre.value + ANCHO_BORRAR }],
  }));

  return (
    <Animated.View style={[e.panel, estilo]}>
      <Pressable onPress={alTocar} style={e.boton}>
        <Trash2 size={16} color={color.blanco} strokeWidth={1.8} />
        <Text style={e.texto}>{etiqueta}</Text>
      </Pressable>
    </Animated.View>
  );
}

const e = StyleSheet.create({
  panel: { width: ANCHO_BORRAR },
  boton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: color.rojo,
  },
  texto: { fontSize: 12.5, fontWeight: "600", color: color.blanco },
});
