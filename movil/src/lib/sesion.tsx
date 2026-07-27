import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// Contexto de sesión. En la web esto lo resolvía el middleware en cada request;
// en nativo la sesión vive en AsyncStorage y se comparte por contexto, con
// onAuthStateChange manteniéndola al día (login, logout, refresh de token).

type EstadoSesion = { sesion: Session | null; cargando: boolean };

const Contexto = createContext<EstadoSesion>({ sesion: null, cargando: true });

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSesion>({ sesion: null, cargando: true });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEstado({ sesion: data.session, cargando: false });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      setEstado({ sesion, cargando: false });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return <Contexto.Provider value={estado}>{children}</Contexto.Provider>;
}

export function useSesion() {
  return useContext(Contexto);
}
