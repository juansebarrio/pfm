// Skeleton sobrio compartido por los cuatro tabs: header + card + lista.
export default function Cargando() {
  return (
    <div aria-hidden className="animate-pulse px-5 pt-14">
      <div className="flex items-center justify-between">
        <div className="h-7 w-40 rounded-md bg-separador" />
        <div className="size-[34px] rounded-full bg-separador" />
      </div>
      <div className="mt-4 h-[120px] rounded-card bg-separador" />
      <div className="mt-6 h-4 w-24 rounded bg-separador" />
      <div className="mt-2 h-[220px] rounded-card bg-separador" />
    </div>
  );
}
