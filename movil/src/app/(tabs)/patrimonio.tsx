import { StyleSheet, Text, View } from "react-native";
import { color } from "@/lib/tema";

// Placeholder del spike — se construye en las fases 3 y 4.
export default function Patrimonio() {
  return (
    <View style={e.centrado}>
      <Text style={e.titulo}>Patrimonio</Text>
      <Text style={e.nota}>Próxima fase</Text>
    </View>
  );
}

const e = StyleSheet.create({
  centrado: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.papel,
  },
  titulo: { fontSize: 15, color: color.tintaSecundaria },
  nota: { marginTop: 4, fontSize: 12, color: color.tintaTerciaria },
});
