import Svg, { Path, Rect } from "react-native-svg";

// La marca de "Fin de mes" dibujada: la hoja que se arranca sobre el tile verde.
// Espeja components/sistema/MarcaFinDeMes.tsx de la web.
//
// POR QUÉ SVG Y NO UN PNG. Es la misma marca que el ícono de la app
// (design/icono/AppIcon-1024.svg), con los mismos dos paths y la misma
// proporción, así que el logo del login y el ícono de la pantalla de inicio son
// literalmente la misma forma. react-native-svg ya es dependencia del proyecto y
// viene dentro de Expo Go, así que esto se ve sin recompilar nada nativo. Un PNG
// perdería nitidez y agregaría un raster más de la marca al repo.
//
// La geometría, porque es fácil errarle si alguien la reescala: los paths van de
// 8 a 88, o sea una caja de 80 dentro de un viewBox de 96. El transform
// translate(t t) scale(s) translate(-8 -8) deja la caja ocupando 80·s desde t, y
// para el 62 % centrado del ícono: s = 96·0,62/80 = 0,744 y t = (96−59,52)/2 =
// 18,24. Son los números del export del diseñador.
//
// OJO CON LA POLARIDAD: la hoja es SIEMPRE crema y el pliegue siempre verde
// oscuro, en los dos temas. El logo anterior usaba color.papel, que se invierte
// con el tema — y eso hacía que la marca fuera oscura sobre verde en modo claro,
// al revés que el ícono de la app.

const HOJA = "M8 32 A24 24 0 0 1 32 8 H64 A24 24 0 0 1 88 32 V54 L54 88 H32 A24 24 0 0 1 8 64 Z";
const PLIEGUE = "M88 54 L54 88 V62 A8 8 0 0 1 62 54 Z";

export function MarcaFinDeMes({ tamano = 36 }: { tamano?: number }) {
  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 96 96">
      {/* rx 21 sobre 96 = el mismo radio proporcional que el tile de 10 sobre 36
          que tenía el logo anterior, así no cambia la silueta al lado del wordmark */}
      <Rect width={96} height={96} rx={21} fill="#4FA37F" />
      <Path
        d={HOJA}
        fill="#F2EFE9"
        transform="translate(18.24 18.24) scale(0.744) translate(-8 -8)"
      />
      <Path
        d={PLIEGUE}
        fill="#2F6F55"
        transform="translate(18.24 18.24) scale(0.744) translate(-8 -8)"
      />
    </Svg>
  );
}
