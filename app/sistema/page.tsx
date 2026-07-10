import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { Badge } from "@/components/sistema/Badge";
import { BarraAvance } from "@/components/sistema/BarraAvance";
import { BotonPrimario } from "@/components/sistema/BotonPrimario";
import { Card, EncabezadoSeccion } from "@/components/sistema/Card";
import { CardPartida } from "@/components/sistema/CardPartida";
import { Chip } from "@/components/sistema/Chip";
import { EstadoVacio } from "@/components/sistema/EstadoVacio";
import { FilaMovimiento } from "@/components/sistema/FilaMovimiento";
import { Importe } from "@/components/sistema/Importe";
import { DemoHoja, DemoTeclado } from "./demos";

export const metadata: Metadata = { title: "Sistema — QA visual" };

// Página interna de QA: todos los componentes con datos del seed Coghlan,
// en claro y oscuro lado a lado, para validar contra el export. Queda para siempre.

const swatches = [
  ["papel", "bg-papel border border-borde"],
  ["superficie", "bg-superficie border border-borde"],
  ["tinta", "bg-tinta"],
  ["secundaria", "bg-tinta-secundaria"],
  ["verde", "bg-verde"],
  ["ámbar", "bg-ambar"],
  ["rojo", "bg-rojo"],
  ["azul", "bg-azul"],
] as const;

function Muestrario() {
  return (
    <div className="space-y-5 px-5 py-6">
      <section>
        <EncabezadoSeccion>Paleta</EncabezadoSeccion>
        <div className="flex flex-wrap gap-2">
          {swatches.map(([nombre, clase]) => (
            <div key={nombre} className="flex flex-col items-center gap-1">
              <div className={`size-[15px] rounded-full ${clase}`} />
              <span className="cifra text-[9px] text-tinta-secundaria">{nombre}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <EncabezadoSeccion>Cifras (Spline Sans Mono)</EncabezadoSeccion>
        <Card className="space-y-1 p-4">
          <div><Importe centavos={8432000} variante="hero-alta" /></div>
          <div><Importe centavos={53920000} variante="hero" /></div>
          <div><Importe centavos={84045000} variante="proyectado" /></div>
          <div><Importe centavos={4740000000} variante="patrimonio" /></div>
          <div className="flex gap-3">
            <Importe centavos={8432000} variante="fila" />
            <Importe centavos={12000000} variante="fila" conSigno className="text-verde" />
            <span className="cifra text-[11px] text-tinta-secundaria">
              $ 268.400 de $ 520.000
            </span>
          </div>
        </Card>
      </section>

      <section>
        <EncabezadoSeccion>Badges</EncabezadoSeccion>
        <Card className="flex flex-wrap items-center gap-2 p-4">
          <Badge variante="hogar">Hogar</Badge>
          <Badge variante="personal">Personal</Badge>
          <Badge variante="estimada">Estimada</Badge>
          <Badge variante="confirmada">Confirmada</Badge>
          <Badge variante="rollover">Rollover</Badge>
          <Badge variante="cuota">Cuota 5/12</Badge>
          <Badge variante="pendiente">Pendiente</Badge>
          <Badge variante="administrador">Administrador</Badge>
          <Badge variante="miembro">Miembro</Badge>
        </Card>
      </section>

      <section>
        <EncabezadoSeccion>Barras de avance</EncabezadoSeccion>
        <Card className="space-y-4 p-4">
          <BarraAvance progreso={0.81} tono="tinta" marcadorDia={10 / 31} etiqueta="barra del mes" />
          <BarraAvance progreso={0.52} tono="atencion" etiqueta="atención" />
          <BarraAvance progreso={1} tono="pagada" etiqueta="fija pagada" />
          <BarraAvance progreso={0.38} tono="ok" etiqueta="sana" />
          <BarraAvance progreso={1} tono="excedido" etiqueta="excedida" />
        </Card>
      </section>

      <section>
        <EncabezadoSeccion>Chips</EncabezadoSeccion>
        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            <Chip escala="medio">Efectivo</Chip>
            <Chip escala="medio">Galicia</Chip>
            <Chip escala="medio">MP</Chip>
            <Chip escala="medio" seleccionado>Visa •• 4321</Chip>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip escala="filtro">Cuenta</Chip>
            <Chip escala="filtro" seleccionado>Hogar</Chip>
            <Chip escala="mini" seleccionado tonoSeleccion="verde">Delivery</Chip>
            <Chip escala="mini">Restaurantes</Chip>
            <Chip escala="mini">todas →</Chip>
          </div>
        </Card>
      </section>

      <section>
        <EncabezadoSeccion>Partidas (estados del seed)</EncabezadoSeccion>
        <Card className="divide-y divide-separador">
          <CardPartida
            nombre="Alquiler" icono="house" asignadoCentavos={78000000}
            gastadoCentavos={78000000} fija estado="ok" sufijoMeta="· fijo"
          />
          <CardPartida
            nombre="Supermercado" icono="shopping-cart" asignadoCentavos={52000000}
            gastadoCentavos={26840000} estado="atencion" excedenteProyectadoCentavos={31204000}
          />
          <CardPartida
            nombre="Delivery" icono="bike" asignadoCentavos={9000000}
            gastadoCentavos={7130000} estado="atencion" excedenteProyectadoCentavos={13103000}
          />
          <CardPartida
            nombre="Restaurantes" icono="utensils" asignadoCentavos={12000000}
            gastadoCentavos={4500000} estado="ok"
          />
          <CardPartida
            nombre="Ahorro e inversión" icono="piggy-bank" asignadoCentavos={40000000}
            gastadoCentavos={40000000} fija esAhorro estado="ok" sufijoMeta="· a Broker"
          />
          <CardPartida
            nombre="Luz" icono="zap" asignadoCentavos={4500000} gastadoCentavos={0}
            estado="ok" avisoRecurrente="recurrente · vence el 18 jul"
          />
          <CardPartida
            nombre="Suscripciones" icono="tv" asignadoCentavos={5500000}
            gastadoCentavos={4120000} rollover rolloverCentavos={1380000}
            estado="ok" textoRollover="arrastrás + $ 13.800 de junio"
          />
          <CardPartida
            nombre="Internet" icono="wifi" asignadoCentavos={0} gastadoCentavos={0}
            estado="ok" desactivada notaDesactivada="desactivada este mes · la paga Vale"
          />
          <CardPartida
            nombre="Nafta" icono="fuel" asignadoCentavos={10000000}
            gastadoCentavos={11500000} estado="excedido"
          />
        </Card>
      </section>

      <section>
        <EncabezadoSeccion>Movimientos</EncabezadoSeccion>
        <Card className="divide-y divide-separador">
          <FilaMovimiento
            descripcion="Coto" icono="shopping-cart"
            metadata="Supermercado · Visa •• 4321" metadataCiclo="cierra 28 jul"
            importeCentavos={8432000} ambito="hogar"
          />
          <FilaMovimiento
            descripcion="Café Cuervo" icono="sparkles" metadata="Gustos · Mercado Pago"
            importeCentavos={680000} ambito="personal"
          />
          <FilaMovimiento
            descripcion="Transferencia recibida" metadata="hoy · Galicia"
            importeCentavos={12000000} esIngreso
          />
          <FilaMovimiento
            descripcion="Aire acondicionado" icono="tag" metadata="1 jul · Hogar"
            importeCentavos={8625000} badgeCuota="Cuota 5/12"
          />
        </Card>
      </section>

      <section>
        <EncabezadoSeccion>Teclado numérico</EncabezadoSeccion>
        <DemoTeclado />
      </section>

      <section>
        <EncabezadoSeccion>CTA y hoja inferior</EncabezadoSeccion>
        <div className="space-y-3">
          <BotonPrimario>Confirmar presupuesto</BotonPrimario>
          <DemoHoja />
        </div>
      </section>

      <section>
        <EncabezadoSeccion>Estado vacío</EncabezadoSeccion>
        <Card className="py-8">
          <EstadoVacio
            Icono={Mail}
            titulo="Armá tu primer presupuesto"
            cuerpo="Asignale un monto a cada partida del mes, como sobres de plata, y mirá cuánto queda a medida que cargás gastos."
            cta={<BotonPrimario ancho="contenido">Empezar con julio</BotonPrimario>}
            sugerencias={
              <>
                <Chip escala="filtro">Dólar billete</Chip>
                <Chip escala="filtro">Plazo fijo</Chip>
                <Chip escala="filtro">FCI</Chip>
              </>
            }
          />
        </Card>
      </section>
    </div>
  );
}

export default function Sistema() {
  return (
    <div className="mx-auto max-w-[900px]">
      <div className="px-5 pt-8">
        <h1 className="text-[22px] font-semibold">Sistema — QA visual</h1>
        <p className="mt-1 text-[13px] text-tinta-secundaria">
          Componentes con datos del seed Coghlan, contra el export. Claro y oscuro.
        </p>
      </div>
      <div className="mt-4 grid gap-0 min-[860px]:grid-cols-2">
        <div data-tema="claro" className="bg-papel text-tinta">
          <Muestrario />
        </div>
        <div data-tema="oscuro" className="bg-papel text-tinta">
          <Muestrario />
        </div>
      </div>
    </div>
  );
}
