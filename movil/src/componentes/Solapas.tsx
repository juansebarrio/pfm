import { Pressable, StyleSheet, Text, View } from "react-native";
import { color, radio } from "@/lib/tema";
import { tacto } from "@/lib/tacto";

// Solapas de vista. Es el mismo dibujo que el segmented de ámbito del
// presupuesto —misma altura, mismo radio, mismo thumb— porque dos controles de
// dos estados en la misma pantalla que se vean distinto se leen como si
// hicieran cosas de distinta naturaleza. Espeja components/sistema/Solapas.tsx.

export function Solapas<T extends string>({
  opciones,
  activa,
  alElegir,
}: {
  opciones: Array<{ clave: T; etiqueta: string }>;
  activa: T;
  alElegir: (clave: T) => void;
}) {
  return (
    <View style={e.contenedor}>
      {opciones.map((o) => {
        const esActiva = activa === o.clave;
        return (
          <Pressable
            key={o.clave}
            onPress={() => {
              if (esActiva) return;
              tacto.toque();
              alElegir(o.clave);
            }}
            style={[e.boton, esActiva && e.activo]}
          >
            <Text style={[e.texto, esActiva && e.textoActivo]}>{o.etiqueta}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const e = StyleSheet.create({
  contenedor: {
    flexDirection: "row",
    marginTop: 14,
    borderRadius: 11,
    backgroundColor: color.fondoSegmented,
    padding: 2,
  },
  boton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 9,
  },
  activo: { backgroundColor: color.segmentedActivo },
  texto: { fontSize: 13, fontWeight: "500", color: color.tintaSecundaria },
  textoActivo: { fontWeight: "600", color: color.tinta },
});
