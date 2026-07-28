import { createClient } from "@supabase/supabase-js";

// POST /api/demo — entrar a la demo desde la app nativa.
//
// ⚠️ Por qué una ruta y no leer las credenciales en el dispositivo: cualquier
// `EXPO_PUBLIC_*` viaja dentro del bundle, así que poner ahí DEMO_EMAIL /
// DEMO_PASSWORD sería publicar la contraseña en la app. Acá el login pasa en el
// server y al dispositivo solo bajan los tokens de esa sesión.
//
// Que cualquiera pueda pedirla es intencional: es exactamente lo que ya hace el
// botón de la web. Los datos son de ejemplo y compartidos.

export async function POST() {
  if (process.env.NEXT_PUBLIC_DEMO !== "true") {
    return Response.json({ error: "La demo no está disponible acá." }, { status: 403 });
  }

  const email = process.env.DEMO_EMAIL;
  const password = process.env.DEMO_PASSWORD;
  if (!email || !password) {
    return Response.json({ error: "La demo no está configurada." }, { status: 503 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return Response.json({ error: "No pudimos entrar a la demo." }, { status: 502 });
  }

  return Response.json({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  });
}
