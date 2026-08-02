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
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { color, radio } from "@/lib/tema";
import { MarcaFinDeMes } from "@/componentes/MarcaFinDeMes";

// Recuperar la contraseña desde la app. Acá solo se pide el correo: el cambio
// se completa en la web (el link aterriza en pfm.js80.studio/clave-nueva), y
// después se vuelve a entrar desde la app con la clave nueva.
//
// Ojo: el Portero global solo conoce login y registro como pantallas públicas,
// así que el login no navega acá: renderiza este componente en su propia ruta
// pasándole `alVolver`. El archivo queda igual registrado como ruta por si el
// Portero suma "olvide-clave" a su lista.

export default function OlvideClave({ alVolver }: { alVolver?: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [pendiente, setPendiente] = useState(false);

  const volver = alVolver ?? (() => router.back());

  async function mandar() {
    if (pendiente) return;
    setPendiente(true);
    // El resultado se ignora a propósito: contestar distinto según exista o no
    // la casilla sería regalar qué emails tienen cuenta. Mismo aviso siempre.
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: "https://pfm.js80.studio/auth/callback?volver=/clave-nueva",
    });
    setPendiente(false);
    setEnviado(true);
  }

  const listo = email.trim() !== "" && !pendiente;

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
          Poné el email de tu cuenta y te mandamos un correo para cambiar la
          clave.
        </Text>
      </View>

      {enviado ? (
        <>
          <Text style={e.aviso}>
            Te mandamos un correo. Cambiá la clave desde el link y volvé a
            entrar acá.
          </Text>
          <Pressable
            onPress={volver}
            style={({ pressed }) => [e.cta, pressed && { opacity: 0.85 }]}
          >
            <Text style={e.ctaTexto}>Volver al login</Text>
          </Pressable>
        </>
      ) : (
        <>
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

          <Pressable
            onPress={mandar}
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
              <Text style={e.ctaTexto}>Mandame el correo</Text>
            )}
          </Pressable>

          <Pressable onPress={volver} style={e.pie} hitSlop={8}>
            <Text style={e.pieTexto}>
              ¿Te acordaste la clave?{" "}
              <Text style={e.pieLink}>Volvé al login</Text>
            </Text>
          </Pressable>
        </>
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
  aviso: {
    textAlign: "center",
    fontSize: 13.5,
    lineHeight: 21,
    fontWeight: "500",
    color: color.verde,
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
  pie: { marginTop: 18, alignItems: "center", paddingVertical: 8 },
  pieTexto: { fontSize: 13, color: color.tintaSecundaria },
  pieLink: { fontWeight: "600", color: color.verde },
});
