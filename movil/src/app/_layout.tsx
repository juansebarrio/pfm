import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ProveedorSesion } from "@/lib/sesion";

// Layout raíz: provee la sesión a toda la app y fija el fondo oscuro (el
// default de Fin de mes). El "portero" vive en index.tsx, que redirige según
// haya sesión o no — el equivalente nativo del middleware de la web.

export default function LayoutRaiz() {
  return (
    <ProveedorSesion>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#141312" },
          }}
        />
      </SafeAreaProvider>
    </ProveedorSesion>
  );
}
