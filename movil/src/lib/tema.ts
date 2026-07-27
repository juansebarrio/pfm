// Tokens del sistema de diseño de Fin de mes, tipados.
//
// Traducidos de app/globals.css (tema OSCURO, que es el default de la app).
// Se usan con StyleSheet en vez de clases de Tailwind: NativeWind estable
// (4.2.6) es anterior a React Native 0.86 y sus className no se aplican; su
// v5 todavía está en preview. Con objetos tipados hay autocompletado y el
// compilador avisa si se usa un token que no existe — algo que las clases
// string no dan.

export const color = {
  papel: "#141312",
  superficie: "#1e1c1a",
  tinta: "#f2efe9",
  tintaSecundaria: "#a39d93",
  tintaTerciaria: "#7d776d",
  tintaMuda: "#4a453f",
  tintaDeshabilitada: "#5f594f",
  verde: "#4fa37f",
  verdeHover: "#63b491",
  verdeSuave: "#1a2a21",
  ambar: "#c6913b",
  ambarTexto: "#c6913b",
  fondoEstimada: "#2a2419",
  bordeEstimada: "#8a6a33",
  rojo: "#cc6b57",
  azul: "#7e9bd6",
  azulSuave: "#232c3d",
  borde: "#34302b",
  separador: "#2a2724",
  pista: "#2e2b26",
  fondoSegmented: "#242220",
  segmentedActivo: "#38342f",
  bordeBandeja: "#4d4028",
  blanco: "#ffffff",
} as const;

/** Radios del export (DESIGN_AUDIT §2.3). */
export const radio = {
  card: 14,
  cta: 12,
  chip: 10,
  chipChico: 9,
  chipMini: 8,
  tag: 4,
} as const;
