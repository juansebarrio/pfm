import { Mail } from "lucide-react";

export function EncabezadoAuth({ subtitulo }: { subtitulo: string }) {
  return (
    <div className="mb-8 flex flex-col items-start gap-4">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-[10px] bg-verde">
          <Mail className="size-5 text-papel" strokeWidth={2} aria-hidden />
        </div>
        <span className="text-[25px] font-semibold tracking-[-0.01em]">
          Fin de mes
        </span>
      </div>
      <p className="text-[13.5px] leading-[1.55] text-tinta-secundaria">
        {subtitulo}
      </p>
    </div>
  );
}
