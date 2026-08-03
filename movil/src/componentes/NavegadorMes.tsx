import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { formatearMesLargo, mesAnterior, mesSiguiente } from "@dominio/fechas";
import { color, fuente } from "@/lib/tema";
import { tacto } from "@/lib/tacto";

// Flechas para ver el historial mes a mes. Espeja
// app/(tabs)/movimientos/NavegadorMes.tsx de la web, con una diferencia: allá
// son links porque el mes vive en la URL; acá es estado de la pantalla, que es
// lo natural en una app sin barra de direcciones.
//
// Adelante NO se topa en el mes en curso: las cuotas generan movimientos con
// fecha futura y arrastrar un gasto al mes que viene es algo que la app ofrece.

export function NavegadorMes({
  mes,
  mesActual,
  alCambiar,
}: {
  mes: string;
  mesActual: string;
  alCambiar: (mes: string) => void;
}) {
  const ir = (destino: string) => {
    tacto.toque();
    alCambiar(destino);
  };

  return (
    <View style={e.fila}>
      <Pressable
        onPress={() => ir(mesAnterior(mes))}
        hitSlop={14}
        accessibilityRole="button"
        accessibilityLabel={`Ver ${formatearMesLargo(mesAnterior(mes))}`}
      >
        <ChevronLeft size={22} color={color.tintaSecundaria} strokeWidth={1.8} />
      </Pressable>

      <View style={e.centro}>
        <Text style={e.mes}>{formatearMesLargo(mes)}</Text>
        {/* el atajo solo aparece cuando sirve */}
        {mes !== mesActual && (
          <Pressable onPress={() => ir(mesActual)} hitSlop={10} accessibilityRole="button">
            <Text style={e.volver}>Volver a este mes</Text>
          </Pressable>
        )}
      </View>

      <Pressable
        onPress={() => ir(mesSiguiente(mes))}
        hitSlop={14}
        accessibilityRole="button"
        accessibilityLabel={`Ver ${formatearMesLargo(mesSiguiente(mes))}`}
      >
        <ChevronRight size={22} color={color.tintaSecundaria} strokeWidth={1.8} />
      </Pressable>
    </View>
  );
}

const e = StyleSheet.create({
  fila: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  centro: { alignItems: "center" },
  mes: {
    fontSize: 15,
    fontFamily: fuente.textoSemi,
    color: color.tinta,
    textTransform: "capitalize",
  },
  volver: {
    marginTop: 1,
    fontSize: 11.5,
    fontFamily: fuente.textoMedio,
    color: color.verde,
    textDecorationLine: "underline",
  },
});
