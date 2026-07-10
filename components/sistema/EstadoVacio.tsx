import type { LucideIcon } from "lucide-react";

// Estado vacío del export (01c, 08b): círculo verde suave de 64px, título 19px,
// cuerpo 13.5/1.55 max 280px, CTA sólido y chips de sugerencia opcionales.

type Props = {
  Icono: LucideIcon;
  titulo: string;
  cuerpo: string;
  cta?: React.ReactNode;
  sugerencias?: React.ReactNode;
};

export function EstadoVacio({ Icono, titulo, cuerpo, cta, sugerencias }: Props) {
  return (
    <div className="flex flex-col items-center px-11 pb-[90px] text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-verde-suave">
        <Icono className="size-7 text-verde" strokeWidth={1.5} aria-hidden />
      </div>
      <h2 className="mt-5 text-[19px] font-semibold text-tinta">{titulo}</h2>
      <p className="mt-2.5 max-w-[280px] text-[13.5px] leading-[1.55] text-tinta-secundaria">
        {cuerpo}
      </p>
      {cta && <div className="mt-6">{cta}</div>}
      {sugerencias && <div className="mt-4 flex gap-2">{sugerencias}</div>}
    </div>
  );
}
