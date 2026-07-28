import { useEffect } from "react";
import { useRouter, useSegments } from "expo-router";
import { useSesion } from "@/lib/sesion";

/**
 * Portero global. `index.tsx` solo decide la ruta de entrada; si la sesión se
 * cae estando adentro (cerrar sesión, borrar la cuenta, un refresh token que
 * venció), sin esto la pantalla se queda montada mostrando tus números.
 *
 * Es el equivalente nativo de lo que en la web hace el middleware en cada
 * request: acá no hay requests, así que el chequeo va contra el contexto.
 */
export function Portero() {
  const { sesion, cargando } = useSesion();
  const segmentos = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (cargando) return;
    // login y registro son las pantallas públicas: ahí no hay adónde sacar a nadie
    const publica = segmentos[0] === "login" || segmentos[0] === "registro";
    if (!sesion && !publica) router.replace("/login");
  }, [sesion, cargando, segmentos, router]);

  return null;
}
