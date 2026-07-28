import { Pressable, StyleSheet, View } from "react-native";
import { Redirect, Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeftRight, House, LineChart, Plus, Wallet } from "lucide-react-native";
import { useSesion } from "@/lib/sesion";
import { color } from "@/lib/tema";

// Tab bar nativa. En la web esto era un <nav> fijo con CSS; acá lo da el
// sistema: blur, safe area y comportamiento de scroll nativos, gratis.

export default function LayoutTabs() {
  const { sesion, cargando } = useSesion();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // sin sesión no se entra a las tabs (equivalente al middleware de la web)
  if (!cargando && !sesion) return <Redirect href="/login" />;

  return (
    <View style={{ flex: 1 }}>
      {/* FAB central del export: flota sobre la tab bar */}
      <View style={[e.fabCapa, { bottom: insets.bottom + 22 }]} pointerEvents="box-none">
        <Pressable
          onPress={() => router.push("/gasto-nuevo")}
          style={({ pressed }) => [e.fab, pressed && { opacity: 0.85 }]}
          accessibilityLabel="Nuevo gasto"
        >
          <Plus size={26} color={color.papel} strokeWidth={2.5} />
        </Pressable>
      </View>

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
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.verde,
    // resplandor verde del export
    shadowColor: color.verde,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
