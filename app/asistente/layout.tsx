import { AtajosTeclado } from "@/components/sistema/AtajosTeclado";
import { BarraLateral } from "@/components/sistema/BarraLateral";

// El asistente comparte el marco de escritorio de las tabs: barra lateral
// fija y atajos de teclado. Sin esto, tocar "Leer comprobante" EN la sidebar
// hacía desaparecer la sidebar, "Asistente" nunca se pintaba activo y no
// había tecla para volver. Abajo de lg no cambia nada: la barra es
// hidden hasta lg y el asistente sigue siendo una pantalla pushed sin TabBar.

export default function LayoutAsistente({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <main className="lg:ml-60">{children}</main>
      <BarraLateral />
      <AtajosTeclado />
    </>
  );
}
