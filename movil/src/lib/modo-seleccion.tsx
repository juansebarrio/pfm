import { createContext, useContext, useState, type ReactNode } from "react";

// Un solo booleano compartido: "hay una pantalla en modo selección".
//
// POR QUÉ HACE FALTA. El botón flotante (la pastilla de cámara + alta manual)
// vive en el layout de las tabs con zIndex 10, o sea por ENCIMA de todo lo que
// dibujan las pantallas. La barra de acción del modo selección va fija abajo, y
// sin esto la pastilla le queda encima justo arriba del botón "Mover": el botón
// existe pero no se puede tocar.
//
// No alcanza con subirle el zIndex a la barra: la pastilla y el contenedor de
// las tabs son hermanos, y zIndex solo compite entre hermanos — nada de adentro
// de las tabs puede pasarle por arriba. Tampoco sirve un Modal, que resolvería
// el apilado pero bloquearía los toques a las filas de atrás, que es justo lo
// que hay que poder tocar mientras seleccionás.
//
// Es un booleano de UI, no estado de negocio: nada más que esto debería vivir acá.

type Estado = { activo: boolean; setActivo: (v: boolean) => void };

const Contexto = createContext<Estado>({ activo: false, setActivo: () => {} });

export function ProveedorModoSeleccion({ children }: { children: ReactNode }) {
  const [activo, setActivo] = useState(false);
  return <Contexto.Provider value={{ activo, setActivo }}>{children}</Contexto.Provider>;
}

export function useModoSeleccion() {
  return useContext(Contexto);
}
