import Link from "next/link";
import { X } from "lucide-react";

export default function NuevoGasto() {
  return (
    <div className="flex min-h-dvh flex-col px-5 pt-14">
      <div className="flex items-center gap-3">
        <Link href="/resumen" aria-label="Cerrar" className="hit-44">
          <X className="size-[22px]" strokeWidth={2} aria-hidden />
        </Link>
        <h1 className="text-[16px] font-semibold">Nuevo gasto</h1>
      </div>
      <p className="mt-4 text-[13.5px] text-tinta-secundaria">
        La alta rápida — la pantalla más usada — llega en la tanda 4.
      </p>
    </div>
  );
}
