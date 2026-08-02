"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/cliente";

/**
 * Rescata la recuperación de clave pedida desde la app nativa. El cliente
 * móvil usa el flujo implícito de Supabase, así que el link del correo vuelve
 * con los tokens en el fragment (#access_token=…), no con ?code=. Como
 * /auth/callback solo canjea códigos, redirige a /login y el navegador
 * arrastra el fragment hasta acá: este componente lo detecta, arma la sesión
 * con el cliente de navegador (que la persiste en cookies, visibles para el
 * servidor) y sigue a /clave-nueva. Sin fragment de recuperación no hace nada.
 */
export function RescateRecuperacion() {
  const router = useRouter();

  useEffect(() => {
    const parametros = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = parametros.get("access_token");
    const refreshToken = parametros.get("refresh_token");
    if (!accessToken || !refreshToken || parametros.get("type") !== "recovery") {
      return;
    }

    const supabase = crearClienteNavegador();
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        // que los tokens no queden en el historial del navegador
        window.history.replaceState(null, "", window.location.pathname);
        if (!error) router.replace("/clave-nueva");
      });
  }, [router]);

  return null;
}
