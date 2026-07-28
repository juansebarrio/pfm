import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ProveedorSesion } from "@/lib/sesion";
import { ProveedorBloqueo } from "@/lib/bloqueo";
import { Portero } from "@/lib/portero";
import { engancharNotificaciones } from "@/lib/avisos";

// Layout raíz: provee la sesión a toda la app y fija el fondo oscuro (el
// default de Fin de mes). El "portero" vive en index.tsx, que redirige según
// haya sesión o no — el equivalente nativo del middleware de la web.
//
// GestureHandlerRootView tiene que envolver TODO: sin él los gestos del
// swipe-to-delete no llegan nunca (falla silenciosa, no tira error).

engancharNotificaciones();

export default function LayoutRaiz() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ProveedorSesion>
        <SafeAreaProvider>
          <ProveedorBloqueo>
            <StatusBar style="light" />
            <Portero />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#141312" },
              }}
            />
          </ProveedorBloqueo>
        </SafeAreaProvider>
      </ProveedorSesion>
    </GestureHandlerRootView>
  );
}
