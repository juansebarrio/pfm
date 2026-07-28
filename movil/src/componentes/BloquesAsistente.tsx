import { StyleSheet, Text, View } from "react-native";
import { TriangleAlert } from "lucide-react-native";
import type { BloqueAsistente, TonoDato } from "@dominio/asistente";
import { color, radio } from "@/lib/tema";
import { BarraAvance } from "@/componentes/sistema";

// Render de los bloques del asistente (ver lib/dominio/asistente.ts). Acá la
// respuesta de la IA deja de ser texto y pasa a usar los componentes reales de
// la app: la misma cifra grande del Resumen, la misma barra del Presupuesto.

const TINTA_TONO: Record<TonoDato, string> = {
  bien: color.verde,
  atencion: color.ambarTexto,
  mal: color.rojo,
  neutro: color.tinta,
};

export function BloquesAsistente({ bloques }: { bloques: BloqueAsistente[] }) {
  return (
    <View style={{ gap: 10 }}>
      {bloques.map((b, i) => {
        switch (b.tipo) {
          case "texto":
            return (
              <Text key={i} style={e.texto}>
                {b.texto}
              </Text>
            );

          case "dato":
            return (
              <View key={i} style={e.card}>
                <Text style={e.etiqueta}>{b.etiqueta}</Text>
                <Text style={[e.cifra, { color: TINTA_TONO[b.tono] }]}>{b.valor}</Text>
              </View>
            );

          case "partida":
            return (
              <View key={i} style={e.card}>
                <View style={e.filaPartida}>
                  <Text numberOfLines={1} style={e.nombrePartida}>
                    {b.nombre}
                  </Text>
                  <Text style={e.montoPartida}>
                    {b.gastado} <Text style={e.deAsignado}>de {b.asignado}</Text>
                  </Text>
                </View>
                {b.progreso !== null && (
                  <View style={{ marginTop: 9 }}>
                    <BarraAvance
                      progreso={b.progreso}
                      tono={b.progreso >= 1 ? "excedido" : b.progreso > 0.85 ? "atencion" : "ok"}
                    />
                  </View>
                )}
              </View>
            );

          case "ojo":
            return (
              <View key={i} style={e.ojo}>
                <TriangleAlert size={15} color={color.ambarTexto} strokeWidth={1.8} />
                <Text style={e.ojoTexto}>{b.texto}</Text>
              </View>
            );

          // las repreguntas las muestra la pantalla abajo de la burbuja, como
          // chips tocables — acá no se dibujan
          case "luego":
            return null;
        }
      })}
    </View>
  );
}

const e = StyleSheet.create({
  texto: { fontSize: 14, lineHeight: 22, color: color.tinta },
  card: {
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.papel,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  etiqueta: { fontSize: 11.5, color: color.tintaSecundaria },
  cifra: { marginTop: 3, fontSize: 26, fontWeight: "600" },
  filaPartida: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  nombrePartida: { flex: 1, fontSize: 13.5, fontWeight: "500", color: color.tinta },
  montoPartida: { fontSize: 12.5, fontWeight: "600", color: color.tinta },
  deAsignado: { fontWeight: "400", color: color.tintaSecundaria },
  ojo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.bordeEstimada,
    backgroundColor: color.fondoEstimada,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  ojoTexto: { flex: 1, fontSize: 12.5, lineHeight: 19, color: color.ambarTexto },
});
