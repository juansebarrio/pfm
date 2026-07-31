import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Camera,
  CreditCard,
  Inbox,
  Lock,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react-native";
import { CLAVE_ONBOARDING, PASOS_ONBOARDING } from "@dominio/onboarding";
import { color, radio } from "@/lib/tema";
import { tacto } from "@/lib/tacto";

// El recorrido de bienvenida. Espeja components/sistema/Onboarding.tsx de la
// web: el contenido vive en lib/dominio/onboarding.ts y acá solo se dibuja.
//
// Se abre solo la primera vez (OnboardingAuto, con AsyncStorage) y siempre
// desde "Enseñame a utilizar la app" en Hogar.

const ICONOS: Record<string, LucideIcon> = {
  wallet: Wallet,
  camera: Camera,
  inbox: Inbox,
  "credit-card": CreditCard,
  lock: Lock,
  sparkles: Sparkles,
};

export function Onboarding({
  abierto,
  alCerrar,
}: {
  abierto: boolean;
  alCerrar: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [paso, setPaso] = useState(0);

  // cada apertura arranca del principio
  useEffect(() => {
    if (abierto) setPaso(0);
  }, [abierto]);

  const p = PASOS_ONBOARDING[paso];
  const Icono = ICONOS[p.icono] ?? Wallet;
  const esUltimo = paso === PASOS_ONBOARDING.length - 1;

  function cerrar() {
    // la marca se escribe al CERRAR: si recargás a mitad del recorrido, lo
    // volvés a ver entero, que es mejor que perderte la mitad para siempre
    void AsyncStorage.setItem(CLAVE_ONBOARDING, "1");
    alCerrar();
  }

  return (
    <Modal visible={abierto} animationType="fade" onRequestClose={cerrar}>
      <View
        style={[
          e.pantalla,
          { paddingTop: Math.max(20, insets.top), paddingBottom: Math.max(24, insets.bottom) },
        ]}
      >
        <View style={e.filaSaltar}>
          <Pressable onPress={cerrar} hitSlop={12}>
            <Text style={e.saltar}>Saltar</Text>
          </Pressable>
        </View>

        <View style={e.centro}>
          <View style={e.circulo}>
            <Icono size={36} color={color.verde} strokeWidth={1.5} />
          </View>
          <Text style={e.titulo}>{p.titulo}</Text>
          <Text style={e.cuerpo}>{p.cuerpo}</Text>
        </View>

        <View style={e.pie}>
          <View style={e.puntos}>
            {PASOS_ONBOARDING.map((_, i) => (
              <View key={i} style={[e.punto, i === paso && e.puntoActivo]} />
            ))}
          </View>
          <View style={e.filaBotones}>
            {paso > 0 && (
              <Pressable
                onPress={() => {
                  tacto.toque();
                  setPaso(paso - 1);
                }}
                hitSlop={10}
                style={e.atras}
              >
                <Text style={e.atrasTexto}>Atrás</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => {
                tacto.toque();
                if (esUltimo) cerrar();
                else setPaso(paso + 1);
              }}
              style={e.cta}
            >
              <Text style={e.ctaTexto}>{esUltimo ? "Listo, a usarla" : "Siguiente"}</Text>
            </Pressable>
          </View>
          <Text style={e.contador}>
            {paso + 1} de {PASOS_ONBOARDING.length}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

/** El disparo de la primera vez: si AsyncStorage ya tiene la marca, nada. */
export function OnboardingAuto() {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CLAVE_ONBOARDING).then((visto) => {
      if (!visto) setAbierto(true);
    });
  }, []);

  return <Onboarding abierto={abierto} alCerrar={() => setAbierto(false)} />;
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.papel, paddingHorizontal: 24 },
  filaSaltar: { flexDirection: "row", justifyContent: "flex-end" },
  saltar: { fontSize: 13, fontWeight: "500", color: color.tintaSecundaria, padding: 6 },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  circulo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.verdeSuave,
  },
  titulo: {
    marginTop: 28,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "600",
    color: color.tinta,
    textAlign: "center",
  },
  cuerpo: {
    marginTop: 14,
    maxWidth: 300,
    fontSize: 14.5,
    lineHeight: 23,
    color: color.tintaSecundaria,
    textAlign: "center",
  },
  pie: { alignItems: "center", gap: 22 },
  puntos: { flexDirection: "row", alignItems: "center", gap: 8 },
  punto: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.tintaMuda },
  puntoActivo: { width: 20, backgroundColor: color.verde },
  filaBotones: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "stretch" },
  atras: { paddingHorizontal: 12 },
  atrasTexto: { fontSize: 13.5, fontWeight: "500", color: color.tintaSecundaria },
  cta: {
    flex: 1,
    height: 48,
    borderRadius: radio.cta,
    backgroundColor: color.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaTexto: { fontSize: 15, fontWeight: "600", color: color.papel },
  contador: { fontSize: 10.5, color: color.tintaTerciaria },
});
