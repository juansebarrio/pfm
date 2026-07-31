import Link from "next/link";

// Solapas de vista, como links: la vista elegida viaja en la URL igual que el
// mes y los filtros, así que la página sigue siendo Server Component y el botón
// "atrás" del navegador vuelve a la vista anterior.
//
// Es el mismo dibujo que el segmented de ámbito del presupuesto — misma altura,
// mismo radio, mismo thumb. Dos controles de dos estados en la misma pantalla
// que se vean distinto se leen como si hicieran cosas de distinta naturaleza.

export function Solapas({
  opciones,
  activa,
}: {
  opciones: Array<{ clave: string; etiqueta: string; href: string }>;
  activa: string;
}) {
  return (
    <nav
      aria-label="Vista"
      className="mt-4 grid rounded-[11px] bg-fondo-segmented p-[2px]"
      style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}
    >
      {opciones.map((o) => (
        <Link
          key={o.clave}
          href={o.href}
          aria-current={activa === o.clave ? "true" : undefined}
          className={`rounded-[9px] py-2 text-center text-[13px] ${
            activa === o.clave
              ? "bg-segmented-activo font-semibold text-tinta shadow-thumb"
              : "font-medium text-tinta-secundaria"
          }`}
        >
          {o.etiqueta}
        </Link>
      ))}
    </nav>
  );
}
