import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { useSesion } from "@/lib/sesion";
import { color } from "@/lib/tema";

// Ruta índice: hace de portero. Con sesión, a las tabs; sin sesión, al login.
export default function Indice() {
  const { sesion, cargando } = useSesion();

  if (cargando) {
    return (
      <View style={e.centrado}>
        <ActivityIndicator color={color.verde} />
      </View>
    );
  }

  return <Redirect href={sesion ? "/(tabs)/resumen" : "/login"} />;
}

const e = StyleSheet.create({
  centrado: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.papel,
  },
});
