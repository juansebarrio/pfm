import { Redirect, Tabs } from "expo-router";
import { ArrowLeftRight, House, LineChart, Wallet } from "lucide-react-native";
import { useSesion } from "@/lib/sesion";

// Tab bar nativa. En la web esto era un <nav> fijo con CSS; acá lo da el
// sistema: blur, safe area y comportamiento de scroll nativos, gratis.

export default function LayoutTabs() {
  const { sesion, cargando } = useSesion();

  // sin sesión no se entra a las tabs (equivalente al middleware de la web)
  if (!cargando && !sesion) return <Redirect href="/login" />;

  return (
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
  );
}
