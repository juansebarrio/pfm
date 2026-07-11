import {
  categoriasDelHogar,
  categoriasRecientes,
  mediosDePago,
} from "@/lib/datos/movimientos";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { AltaRapida } from "./AltaRapida";

// Alta rápida (03, DESIGN_AUDIT.md §1.5): pantalla completa sin tab bar.
// El server junta medios y las categorías de AMBOS ámbitos de una vez,
// así el cambio Hogar/Personal en el cliente es instantáneo, sin refetch.
export default async function NuevoGasto() {
  const sesion = await obtenerSesionHogar();
  const [medios, recientesHogar, recientesPersonal, todas] = await Promise.all([
    mediosDePago(sesion),
    categoriasRecientes(sesion, "hogar"),
    categoriasRecientes(sesion, "personal"),
    categoriasDelHogar(sesion),
  ]);

  return (
    <AltaRapida
      medios={medios}
      categoriasHogar={recientesHogar}
      categoriasPersonales={recientesPersonal}
      todasHogar={todas.filter((c) => c.ambito === "hogar")}
      todasPersonales={todas.filter((c) => c.ambito === "personal")}
    />
  );
}
