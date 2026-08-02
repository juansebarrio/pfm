import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_600SemiBold,
  Rubik_700Bold,
} from "@expo-google-fonts/rubik";
import {
  SplineSansMono_400Regular,
  SplineSansMono_500Medium,
  SplineSansMono_600SemiBold,
  SplineSansMono_700Bold,
} from "@expo-google-fonts/spline-sans-mono";
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
//
// Tipografía de la identidad (DESIGN_AUDIT §2.2): Rubik para palabras y
// Spline Sans Mono para cifras. El splash se sostiene hasta que carguen para
// que ningún texto parpadee en SF Pro; si la carga falla, la app arranca
// igual con la fuente del sistema antes que quedarse en el splash.

engancharNotificaciones();

SplashScreen.preventAutoHideAsync();

export default function LayoutRaiz() {
  const [fuentesListas, errorFuentes] = useFonts({
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_600SemiBold,
    Rubik_700Bold,
    SplineSansMono_400Regular,
    SplineSansMono_500Medium,
    SplineSansMono_600SemiBold,
    SplineSansMono_700Bold,
  });

  useEffect(() => {
    if (fuentesListas || errorFuentes) {
      SplashScreen.hideAsync();
    }
  }, [fuentesListas, errorFuentes]);

  if (!fuentesListas && !errorFuentes) {
    return null;
  }

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
