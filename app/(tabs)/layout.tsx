import { BarraLateral } from "@/components/sistema/BarraLateral";
import { TabBar } from "@/components/sistema/TabBar";

// Hasta lg: columna de teléfono con TabBar abajo. De lg para arriba: barra
// lateral fija y el contenido en una columna de lectura de hasta 960px.

export default function LayoutTabs({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <main className="pb-[110px] lg:ml-60 lg:pb-12">
        <div className="lg:mx-auto lg:max-w-[960px] lg:px-4">{children}</div>
      </main>
      <BarraLateral />
      <TabBar />
    </>
  );
}
