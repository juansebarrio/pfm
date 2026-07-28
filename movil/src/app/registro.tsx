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
import { Mail } from "lucide-react-native";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { color, radio } from "@/lib/tema";

// Registro nativo. Espeja registrarse() de app/(auth)/acciones.ts: mismos
// mensajes de error y el mismo aviso cuando el proyecto exige confirmar el
// email. El hogar inicial NO se crea acá: lo hace obtenerSesionHogar en el
// primer ingreso, igual que en la web.

export default function Registro() {
  const router = useRouter();
  const { sesion } = useSesion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);

  async function crear() {
    if (pendiente) return;
    setError(null);
    setAviso(null);
    if (password.length < 8) {
      setError("La contraseña necesita al menos 8 caracteres");
      return;
    }
    setPendiente(true);
    const { data, error: e } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (e) {
      setError(
        e.code === "user_already_exists"
          ? "Ya existe una cuenta con ese email. Iniciá sesión."
          : e.code === "weak_password"
            ? "Esa contraseña es demasiado débil. Probá otra."
            : e.message.toLowerCase().includes("invalid")
              ? "Ingresá un email válido."
              : "No pudimos crear la cuenta. Probá de nuevo.",
      );
      setPendiente(false);
      return;
    }
    // sin sesión = el proyecto exige confirmación por email
    if (!data.session) {
      setAviso("Te mandamos un correo para confirmar la cuenta. Después entrá desde acá.");
      setPendiente(false);
    }
    // con sesión, el contexto la ve y el Redirect de abajo dispara
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
          Creá tu cuenta. Al entrar por primera vez ya vas a tener tu hogar con
          las categorías listas para armar el presupuesto.
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
      {aviso && <Text style={e.aviso}>{aviso}</Text>}

      <Pressable
        onPress={crear}
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
          <Text style={e.ctaTexto}>Crear cuenta</Text>
        )}
      </Pressable>

      <Pressable onPress={() => router.back()} style={e.volver} hitSlop={8}>
        <Text style={e.volverTexto}>
          ¿Ya tenés cuenta? <Text style={e.volverLink}>Iniciá sesión</Text>
        </Text>
      </Pressable>
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
  etiqueta: { marginBottom: 6, fontSize: 13, fontWeight: "600", color: color.tinta },
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
    marginTop: 14,
    textAlign: "center",
    fontSize: 12.5,
    fontWeight: "500",
    color: color.rojo,
  },
  aviso: {
    marginTop: 14,
    textAlign: "center",
    fontSize: 12.5,
    lineHeight: 19,
    fontWeight: "500",
    color: color.verde,
  },
  cta: {
    marginTop: 20,
    height: 50,
    borderRadius: radio.cta,
    backgroundColor: color.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaApagado: { opacity: 0.5 },
  ctaTexto: { fontSize: 15, fontWeight: "600", color: color.papel },
  volver: { marginTop: 20, alignItems: "center", paddingVertical: 8 },
  volverTexto: { fontSize: 13, color: color.tintaSecundaria },
  volverLink: { fontWeight: "600", color: color.verde },
});
