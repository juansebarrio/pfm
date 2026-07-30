import { MarcaFinDeMes } from "@/components/sistema/MarcaFinDeMes";

export function EncabezadoAuth({ subtitulo }: { subtitulo: string }) {
  return (
    <div className="mb-8 flex flex-col items-start gap-4">
      <div className="flex items-center gap-3">
        <MarcaFinDeMes />
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
