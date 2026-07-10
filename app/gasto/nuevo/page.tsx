import { categoriasRecientes, mediosDePago } from "@/lib/datos/movimientos";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { AltaRapida } from "./AltaRapida";

// Alta rápida (03, DESIGN_AUDIT.md §1.5): pantalla completa sin tab bar.
// El server junta medios y las categorías de AMBOS ámbitos de una vez,
// así el cambio Hogar/Personal en el cliente es instantáneo, sin refetch.
export default async function NuevoGasto() {
  const sesion = await obtenerSesionHogar();
  const [medios, categoriasHogar, categoriasPersonales] = await Promise.all([
    mediosDePago(sesion),
    categoriasRecientes(sesion, "hogar"),
    categoriasRecientes(sesion, "personal"),
  ]);

  return (
    <AltaRapida
      medios={medios}
      categoriasHogar={categoriasHogar}
      categoriasPersonales={categoriasPersonales}
    />
  );
}
