import { NextResponse, type NextRequest } from "next/server";
import { cifrarToken } from "@/lib/gmail/cifrado";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// Vuelta del OAuth de Google (login y "Conectar Gmail"). Canjea el código por
// la sesión; si la vuelta es de conectar Gmail (?conectar=gmail), guarda el
// refresh token CIFRADO para poder sincronizar después sin re-consentimiento.

function rutaSegura(volver: string | null): string {
  return volver && /^\/[a-zA-Z0-9\-_/]*$/.test(volver) ? volver : "/resumen";
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const codigo = searchParams.get("code");
  const volver = rutaSegura(searchParams.get("volver"));
  const conectar = searchParams.get("conectar") === "gmail";

  if (!codigo) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.exchangeCodeForSession(codigo);
  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/login`);
  }

  if (conectar) {
    // el refresh token solo viene con access_type=offline + prompt=consent
    const refreshToken = data.session.provider_refresh_token;
    if (!refreshToken) {
      return NextResponse.redirect(`${origin}/cuentas?gmail=sin-permiso`);
    }
    const { error: errorGuardar } = await supabase.from("conexiones_gmail").upsert(
      {
        user_id: data.session.user.id,
        email_gmail: data.session.user.email ?? "",
        refresh_token_cifrado: cifrarToken(refreshToken),
      },
      { onConflict: "user_id" },
    );
    if (errorGuardar) {
      return NextResponse.redirect(`${origin}/cuentas?gmail=error`);
    }
    return NextResponse.redirect(`${origin}/cuentas?gmail=conectado`);
  }

  return NextResponse.redirect(`${origin}${volver}`);
}
