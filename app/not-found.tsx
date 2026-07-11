import Link from "next/link";
import { Compass } from "lucide-react";
import { EstadoVacio } from "@/components/sistema/EstadoVacio";

export default function NoEncontrada() {
  return (
    <div className="flex min-h-dvh flex-col justify-center">
      <EstadoVacio
        Icono={Compass}
        titulo="Esa pantalla no existe"
        cuerpo="El link puede estar vencido o mal escrito. Volvé al resumen y seguí desde ahí."
        cta={
          <Link
            href="/resumen"
            className="inline-block rounded-cta bg-verde px-[30px] py-3.5 text-[14.5px] font-semibold text-papel"
          >
            Ir al resumen
          </Link>
        }
      />
    </div>
  );
}
