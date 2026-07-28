import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Redirect } from "expo-router";
import { Mail } from "lucide-react-native";
import { useSesion } from "@/lib/sesion";
import { entrarDemo } from "@/lib/cuenta";
import { supabase } from "@/lib/supabase";
import { color, radio } from "@/lib/tema";

const DEMO = process.env.EXPO_PUBLIC_DEMO === "true";

// Login nativo. Mismo copy y jerarquía visual que app/(auth)/login de la web,
// con inputs nativos: teclado de email, sin autocapitalize y KeyboardAvoiding.

export default function Login() {
  const { sesion } = useSesion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);

  async function entrar() {
    if (pendiente) return;
    setError(null);
    setPendiente(true);
    const { error: e } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (e) {
      setError(
        e.message.toLowerCase().includes("invalid login")
          ? "Email o contraseña incorrectos."
          : "No pudimos iniciar sesión. Probá de nuevo.",
      );
      setPendiente(false);
    }
    // con éxito, el contexto ve la sesión nueva y el Redirect de abajo dispara
  }

  async function demo() {
    if (pendiente) return;
    setError(null);
    setPendiente(true);
    const r = await entrarDemo();
    if (!r.ok) {
      setError(r.error);
      setPendiente(false);
    }
  }

  if (sesion) return <Redirect href="/(tabs)/resumen" />;

  const listo = email.trim() !== "" && password !== "" && !pendiente;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={e.pantalla}
    >
      <View style={e.encabezado}>
        <View style={e.filaMarca}>
          <View style={e.logo}>
            <Mail size={20} color={color.papel} strokeWidth={2} />
          </View>
          <Text style={e.marca}>Fin de mes</Text>
        </View>
        <Text style={e.subtitulo}>
          Llegá tranquilo a fin de mes. Presupuesto del hogar y personal,
          tarjetas con ciclos reales y patrimonio, hecho para Argentina.
        </Text>
      </View>

      <Text style={e.etiqueta}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="tu@email.com"
        placeholderTextColor={color.tintaTerciaria}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        style={e.input}
      />

      <Text style={[e.etiqueta, { marginTop: 16 }]}>Contraseña</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Mínimo 8 caracteres"
        placeholderTextColor={color.tintaTerciaria}
        secureTextEntry
        autoCapitalize="none"
        style={e.input}
      />

      {error && <Text style={e.error}>{error}</Text>}

      <Pressable
        onPress={entrar}
        disabled={!listo}
        style={({ pressed }) => [
          e.cta,
          !listo && e.ctaApagado,
          pressed && { opacity: 0.85 },
        ]}
      >
        {pendiente ? (
          <ActivityIndicator color={color.papel} />
        ) : (
          <Text style={e.ctaTexto}>Entrar</Text>
        )}
      </Pressable>

      {/* Probar sin cuenta. Igual que en la web, solo donde hay demo cargada. */}
      {DEMO && (
        <View style={{ marginTop: 24 }}>
          <View style={e.separadorFila}>
            <View style={e.linea} />
            <Text style={e.separadorTexto}>o probá sin cuenta</Text>
            <View style={e.linea} />
          </View>
          <Pressable
            onPress={demo}
            disabled={pendiente}
            style={[e.ctaDemo, pendiente && { opacity: 0.6 }]}
          >
            <Text style={e.ctaDemoTexto}>Ver demo de prueba</Text>
          </Pressable>
          <Text style={e.avisoDemo}>
            Datos de ejemplo compartidos, solo para explorar.
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const e = StyleSheet.create({
  pantalla: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: color.papel,
    paddingHorizontal: 20,
  },
  encabezado: { marginBottom: 32 },
  filaMarca: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.verde,
  },
  marca: { fontSize: 25, fontWeight: "600", color: color.tinta },
  subtitulo: {
    marginTop: 16,
    fontSize: 13.5,
    lineHeight: 21,
    color: color.tintaSecundaria,
  },
  etiqueta: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "600",
    color: color.tinta,
  },
  input: {
    height: 50,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.borde,
    backgroundColor: color.superficie,
    paddingHorizontal: 14,
    fontSize: 16,
    color: color.tinta,
  },
  error: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 12.5,
    fontWeight: "500",
    color: color.rojo,
  },
  cta: {
    marginTop: 20,
    height: 50,
    borderRadius: radio.cta,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.verde,
  },
  ctaApagado: { opacity: 0.6 },
  ctaTexto: { fontSize: 15, fontWeight: "600", color: color.papel },
  separadorFila: { flexDirection: "row", alignItems: "center", gap: 12 },
  linea: { flex: 1, height: 1, backgroundColor: color.borde },
  separadorTexto: { fontSize: 11.5, color: color.tintaSecundaria },
  ctaDemo: {
    marginTop: 16,
    height: 50,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaDemoTexto: { fontSize: 15, fontWeight: "600", color: color.verde },
  avisoDemo: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 11,
    color: color.tintaSecundaria,
  },
});
