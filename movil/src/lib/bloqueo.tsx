import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { Lock } from "lucide-react-native";
import { color, fuente, radio } from "@/lib/tema";

// Bloqueo biométrico. Lo que la web no puede dar: la app se tapa sola cuando
// pasa a segundo plano y pide Face ID para volver.
//
// ⚠️ En Expo Go, Face ID de iOS NO funciona (limitación documentada del SDK 57:
// hace falta un development build). Por eso, si el dispositivo no tiene
// biometría disponible o enrolada, el bloqueo se desactiva solo en vez de
// dejarte afuera de tu propia app.

const CLAVE = "fdm.bloqueo";
/** Segundos en segundo plano antes de pedir Face ID. Cambiar de app un
 *  momento para copiar un importe no debería costar una autenticación. */
const GRACIA_MS = 30_000;

type EstadoBloqueo = {
  activo: boolean;
  disponible: boolean;
  bloqueado: boolean;
  alternar: () => Promise<void>;
  desbloquear: () => Promise<void>;
};

const Contexto = createContext<EstadoBloqueo>({
  activo: false,
  disponible: false,
  bloqueado: false,
  alternar: async () => {},
  desbloquear: async () => {},
});

async function hayBiometria() {
  const [hardware, enrolado] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hardware && enrolado;
}

export function ProveedorBloqueo({ children }: { children: ReactNode }) {
  const [disponible, setDisponible] = useState(false);
  const [activo, setActivo] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const salidaRef = useRef<number | null>(null);
  const autenticando = useRef(false);

  useEffect(() => {
    (async () => {
      const puede = await hayBiometria();
      setDisponible(puede);
      const guardado = await AsyncStorage.getItem(CLAVE);
      if (puede && guardado === "1") {
        setActivo(true);
        setBloqueado(true); // arrancar cerrada: el primer ingreso pide cara
      }
    })();
  }, []);

  const desbloquear = useCallback(async () => {
    if (autenticando.current) return;
    autenticando.current = true;
    try {
      const r = await LocalAuthentication.authenticateAsync({
        promptMessage: "Desbloqueá Fin de mes",
        cancelLabel: "Cancelar",
      });
      if (r.success) setBloqueado(false);
    } finally {
      autenticando.current = false;
    }
  }, []);

  // Al volver del segundo plano, si estuvo afuera más que la gracia, se cierra.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (estado) => {
      if (!activo) return;
      if (estado === "background" || estado === "inactive") {
        salidaRef.current ??= Date.now();
      } else if (estado === "active") {
        const salida = salidaRef.current;
        salidaRef.current = null;
        if (salida !== null && Date.now() - salida > GRACIA_MS) setBloqueado(true);
      }
    });
    return () => sub.remove();
  }, [activo]);

  // Cuando se cierra, se pide la cara sin que haya que tocar nada.
  useEffect(() => {
    if (bloqueado) void desbloquear();
  }, [bloqueado, desbloquear]);

  const alternar = useCallback(async () => {
    if (!disponible) return;
    if (activo) {
      // apagarlo también pide autenticación: si te robaron el teléfono
      // desbloqueado, que no puedan sacarle el candado
      const r = await LocalAuthentication.authenticateAsync({
        promptMessage: "Confirmá para sacar el bloqueo",
        cancelLabel: "Cancelar",
      });
      if (!r.success) return;
      setActivo(false);
      await AsyncStorage.setItem(CLAVE, "0");
    } else {
      setActivo(true);
      await AsyncStorage.setItem(CLAVE, "1");
    }
  }, [activo, disponible]);

  return (
    <Contexto.Provider value={{ activo, disponible, bloqueado, alternar, desbloquear }}>
      {children}
      {bloqueado && <Pantalla alReintentar={desbloquear} />}
    </Contexto.Provider>
  );
}

/** Tapa la app entera: ni de reojo se ven los números. */
function Pantalla({ alReintentar }: { alReintentar: () => void }) {
  return (
    <View style={e.tapa}>
      <View style={e.circulo}>
        <Lock size={26} color={color.verde} strokeWidth={1.5} />
      </View>
      <Text style={e.titulo}>Fin de mes está bloqueada</Text>
      <Pressable onPress={alReintentar} style={e.boton}>
        <Text style={e.botonTexto}>Desbloquear</Text>
      </Pressable>
    </View>
  );
}

export function useBloqueo() {
  return useContext(Contexto);
}

const e = StyleSheet.create({
  tapa: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.papel,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  circulo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: color.verdeSuave,
    alignItems: "center",
    justifyContent: "center",
  },
  titulo: { fontSize: 16, fontFamily: fuente.textoSemi, color: color.tinta },
  boton: {
    borderRadius: radio.cta,
    backgroundColor: color.verde,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  botonTexto: { fontSize: 14.5, fontFamily: fuente.textoSemi, color: color.papel },
});
