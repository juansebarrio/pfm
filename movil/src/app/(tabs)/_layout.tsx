import { Pressable, StyleSheet, View } from "react-native";
import { Redirect, Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeftRight, Camera, House, LineChart, Plus, Wallet } from "lucide-react-native";
import { useSesion } from "@/lib/sesion";
import {
  ProveedorModoSeleccion,
  useModoSeleccion,
} from "@/lib/modo-seleccion";
import { color } from "@/lib/tema";

// Tab bar nativa. En la web esto era un <nav> fijo con CSS; acá lo da el
// sistema: blur, safe area y comportamiento de scroll nativos, gratis.
//
// El botón flotante es DOBLE: una pastilla partida al medio. Izquierda, la
// cámara: saca la foto de un comprobante y el asistente lo lee. Derecha, el +:
// el alta a mano de siempre. Las dos formas de cargar un movimiento tienen el
// mismo peso visual porque tienen el mismo peso real — a veces tenés el ticket
// en la mano y a veces sabés el número de memoria.
//
// La pastilla va MÁS ARRIBA que el + redondo que reemplazó: es más ancha, y a
// la altura vieja se le comía las etiquetas de Presupuesto y Movimientos.

export default function LayoutTabs() {
  return (
    <ProveedorModoSeleccion>
      <Tabs_ />
    </ProveedorModoSeleccion>
  );
}

function Tabs_() {
  const { sesion, cargando } = useSesion();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // mientras una pantalla está seleccionando, la pastilla se esconde: si no,
  // le queda encima a la barra de acción y tapa el botón que hay que tocar
  const { activo: seleccionando } = useModoSeleccion();

  // sin sesión no se entra a las tabs (equivalente al middleware de la web)
  if (!cargando && !sesion) return <Redirect href="/login" />;

  return (
    <View style={{ flex: 1 }}>
      {!seleccionando && (
      <View style={[e.fabCapa, { bottom: insets.bottom + 58 }]} pointerEvents="box-none">
        <View style={e.pastilla}>
          <Pressable
            onPress={() => router.push("/asistente?camara=1")}
            style={({ pressed }) => [e.mitad, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            // la web dice "Leer un comprobante con el asistente" porque allá el
            // link lleva al chat; acá la cámara se abre sola, y la etiqueta
            // tiene que decir lo que el botón hace, no lo que hace su gemelo
            accessibilityLabel="Sacarle una foto a un comprobante"
          >
            <Camera size={23} color={color.papel} strokeWidth={2} />
          </Pressable>
          {/* aria-hidden en la web: el divisor es dibujo, no contenido */}
          <View
            style={e.divisor}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          <Pressable
            onPress={() => router.push("/gasto-nuevo")}
            style={({ pressed }) => [e.mitad, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Cargar un movimiento a mano"
          >
            <Plus size={25} color={color.papel} strokeWidth={2.5} />
          </Pressable>
        </View>
      </View>
      )}

    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#4fa37f",
        tabBarInactiveTintColor: "#a39d93",
        tabBarStyle: {
          backgroundColor: "#1e1c1a",
          borderTopColor: "#34302b",
        },
        tabBarLabelStyle: { fontSize: 11 },
        sceneStyle: { backgroundColor: "#141312" },
      }}
    >
      <Tabs.Screen
        name="resumen"
        options={{
          title: "Resumen",
          tabBarIcon: ({ color, size }) => <House color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="presupuesto"
        options={{
          title: "Presupuesto",
          tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="movimientos"
        options={{
          title: "Movimientos",
          tabBarIcon: ({ color, size }) => (
            <ArrowLeftRight color={color} size={size} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="patrimonio"
        options={{
          title: "Patrimonio",
          tabBarIcon: ({ color, size }) => (
            <LineChart color={color} size={size} strokeWidth={1.5} />
          ),
        }}
      />
      </Tabs>
    </View>
  );
}

const e = StyleSheet.create({
  fabCapa: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: "center",
  },
  pastilla: {
    flexDirection: "row",
    alignItems: "center",
    height: 54,
    borderRadius: 27,
    backgroundColor: color.verde,
    // el resplandor verde del export, ahora sobre la pastilla entera
    shadowColor: color.verde,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  // 58 de ancho por mitad: pasa los 44 pt de Apple con holgura y deja aire
  // suficiente entre los dos íconos para que se lean como dos botones
  mitad: { width: 58, height: 54, alignItems: "center", justifyContent: "center" },
  // el divisor tiene que VERSE: es lo único que dice que son dos botones y no
  // uno con dos dibujos. A hairline sobre el verde menta desaparecía.
  divisor: { width: 1, height: 26, backgroundColor: "rgba(0,0,0,0.3)" },
});
