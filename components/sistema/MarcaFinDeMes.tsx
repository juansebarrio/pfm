// La marca de "Fin de mes" dibujada: la hoja que se arranca sobre el tile verde.
//
// POR QUÉ ES UN COMPONENTE Y NO UNA IMAGEN. Es la misma marca que el ícono de la
// app (design/icono/AppIcon-1024.svg), con los mismos dos paths y la misma
// proporción, así que el logo de /login y el ícono de la pantalla de inicio son
// literalmente la misma forma. Como SVG inline queda nítido a cualquier densidad
// y no suma un raster más de la marca al repo.
//
// La geometría, porque es fácil errarle si alguien la reescala: los paths van de
// 8 a 88, o sea una caja de 80 dentro de un viewBox de 96. El transform
// translate(t t) scale(s) translate(-8 -8) deja la caja ocupando 80·s desde t,
// y para el 62 % centrado del ícono: s = 96·0,62/80 = 0,744 y t = (96−59,52)/2 =
// 18,24. Son los números del export del diseñador, no inventados acá.
//
// OJO CON LA POLARIDAD: la hoja es SIEMPRE crema (#F2EFE9) y el pliegue siempre
// verde oscuro (#2F6F55), en los dos temas. El logo anterior usaba text-papel,
// que se invierte con el tema — y eso hacía que en modo claro la marca fuera
// oscura sobre verde, al revés que el ícono de la app.

const HOJA = "M8 32 A24 24 0 0 1 32 8 H64 A24 24 0 0 1 88 32 V54 L54 88 H32 A24 24 0 0 1 8 64 Z";
const PLIEGUE = "M88 54 L54 88 V62 A8 8 0 0 1 62 54 Z";

export function MarcaFinDeMes({ className = "size-9" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 96 96"
      className={`${className} shrink-0 rounded-[10px]`}
      role="img"
      aria-label="Fin de mes"
    >
      <rect width="96" height="96" fill="#4FA37F" />
      <g transform="translate(18.24 18.24) scale(0.744) translate(-8 -8)">
        <path d={HOJA} fill="#F2EFE9" />
        <path d={PLIEGUE} fill="#2F6F55" />
      </g>
    </svg>
  );
}
