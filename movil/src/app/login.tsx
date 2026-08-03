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
import { Redirect, useRouter } from "expo-router";
import { useSesion } from "@/lib/sesion";
import { entrarDemo } from "@/lib/cuenta";
import { supabase } from "@/lib/supabase";
import { color, fuente, radio } from "@/lib/tema";
import { MarcaFinDeMes } from "@/componentes/MarcaFinDeMes";
import OlvideClave from "./olvide-clave";

const DEMO = process.env.EXPO_PUBLIC_DEMO === "true";

// Login nativo. Mismo copy y jerarquía visual que app/(auth)/login de la web,
// con inputs nativos: teclado de email, sin autocapitalize y KeyboardAvoiding.
//
// "¿Olvidaste tu contraseña?" no navega a /olvide-clave: el Portero global
// expulsaría la ruta por no tener sesión. Se renderiza la pantalla acá mismo,
// con la ruta todavía en "login", y `alVolver` la cierra.

export default function Login() {
  const router = useRouter();
  const { sesion } = useSesion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);
  const [olvide, setOlvide] = useState(false);

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

  if (olvide) return <OlvideClave alVolver={() => setOlvide(false)} />;

  const listo = email.trim() !== "" && password !== "" && !pendiente;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={e.pantalla}
    >
      <View style={e.encabezado}>
        <View style={e.filaMarca}>
          <MarcaFinDeMes />
          <Text style={e.marca}>Fin de mes</Text>
        </View>
        <Text style={e.subtitulo}>
          Llegá sin sobresaltos a fin de mes. Presupuesto del hogar y personal,
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
        textContentType="emailAddress"
        autoComplete="email"
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
        textContentType="password"
        autoComplete="current-password"
        style={e.input}
      />

      <Pressable onPress={() => setOlvide(true)} style={e.olvide} hitSlop={8}>
        <Text style={e.olvideTexto}>¿Olvidaste tu contraseña?</Text>
      </Pressable>

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

      <Pressable
        onPress={() => router.push("/registro")}
        style={e.registro}
        hitSlop={8}
      >
        <Text style={e.registroTexto}>
          ¿Primera vez? <Text style={e.registroLink}>Creá tu cuenta</Text>
        </Text>
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
  marca: { fontSize: 25, fontFamily: fuente.textoSemi, color: color.tinta },
  subtitulo: {
    marginTop: 16,
    fontSize: 13.5,
    lineHeight: 21,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
  etiqueta: {
    marginBottom: 6,
    fontSize: 13,
    fontFamily: fuente.textoSemi,
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
    fontFamily: fuente.texto,
    color: color.tinta,
  },
  error: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 12.5,
    fontFamily: fuente.textoMedio,
    color: color.rojo,
  },
  olvide: { marginTop: 10, alignSelf: "flex-end" },
  olvideTexto: { fontSize: 13, fontFamily: fuente.textoSemi, color: color.verde },
  cta: {
    marginTop: 20,
    height: 50,
    borderRadius: radio.cta,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.verde,
  },
  ctaApagado: { opacity: 0.6 },
  ctaTexto: { fontSize: 15, fontFamily: fuente.textoSemi, color: color.papel },
  registro: { marginTop: 18, alignItems: "center", paddingVertical: 8 },
  registroTexto: { fontSize: 13, fontFamily: fuente.texto, color: color.tintaSecundaria },
  // el peso del link es OTRO archivo de Rubik, no un fontWeight encima
  registroLink: { fontFamily: fuente.textoSemi, color: color.verde },
  separadorFila: { flexDirection: "row", alignItems: "center", gap: 12 },
  linea: { flex: 1, height: 1, backgroundColor: color.borde },
  separadorTexto: { fontSize: 11.5, fontFamily: fuente.texto, color: color.tintaSecundaria },
  ctaDemo: {
    marginTop: 16,
    height: 50,
    borderRadius: radio.cta,
    borderWidth: 1,
    borderColor: color.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaDemoTexto: { fontSize: 15, fontFamily: fuente.textoSemi, color: color.verde },
  avisoDemo: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 11,
    fontFamily: fuente.texto,
    color: color.tintaSecundaria,
  },
});
