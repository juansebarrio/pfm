import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /auth: vuelta del OAuth de Google (el código se canjea ahí, aún sin sesión)
// /privacidad: Apple exige que se pueda leer ANTES de crear una cuenta
const RUTAS_PUBLICAS = ["/login", "/registro", "/invitacion", "/auth", "/privacidad"];

function esRutaPublica(pathname: string) {
  return RUTAS_PUBLICAS.some(
    (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`),
  );
}

/**
 * La app nativa no tiene cookies: manda `Authorization: Bearer <access_token>`.
 * Esos pedidos pasan sin el portero de cookies porque el route handler valida
 * el token él mismo (y responde 401 si no sirve). Se limita a /api/ a propósito:
 * las páginas siempre pasan por el portero.
 */
function esPedidoConPortador(request: NextRequest) {
  return (
    request.nextUrl.pathname.startsWith("/api/") &&
    request.headers.get("authorization")?.startsWith("Bearer ") === true
  );
}

export async function middleware(request: NextRequest) {
  if (esPedidoConPortador(request)) return NextResponse.next({ request });

  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesAEscribir) {
          cookiesAEscribir.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          respuesta = NextResponse.next({ request });
          cookiesAEscribir.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // No intercalar lógica entre la creación del cliente y getUser():
  // el refresco de tokens depende de esta llamada.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !esRutaPublica(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/registro")) {
    const url = request.nextUrl.clone();
    url.pathname = "/resumen";
    return NextResponse.redirect(url);
  }

  return respuesta;
}

export const config = {
  matcher: [
    /*
     * Todo salvo estáticos y assets de PWA:
     * _next/static, _next/image, favicon, manifest, sw, iconos e imágenes.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|iconos/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
