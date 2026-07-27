import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// Cliente de Supabase para React Native. Diferencias con la web:
//  - la sesión se guarda en AsyncStorage (no en cookies), porque no hay
//    middleware que refresque el token en cada request;
//  - autoRefreshToken lo maneja el cliente, atado al ciclo de vida de la app;
//  - detectSessionInUrl va en false: no hay URL que parsear en nativo.
// La RLS de la base sigue siendo la misma barrera de seguridad que en la web.

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const clave = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !clave) {
  throw new Error(
    "Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY en movil/.env",
  );
}

export const supabase = createClient(url, clave, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
