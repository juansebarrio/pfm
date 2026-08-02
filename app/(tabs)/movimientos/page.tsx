import Link from "next/link";
import { ChartPie, List } from "lucide-react";
import {
  bandejaDeEntrada,
  categoriasDelHogar,
  categoriasRecientes,
  mediosDePago,
  gastosPorCategoria,
  totalesDelMes,
  type MovimientoLista,
} from "@/lib/datos/movimientos";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { formatearImporte } from "@/lib/dominio/dinero";
import {
  etiquetaDia,
  formatearMesLargo,
  hoyBA,
  mesDe,
  mesDesdeParametro,
} from "@/lib/dominio/fechas";
import { NavegadorMes } from "@/components/sistema/NavegadorMes";
import { PorCategoria } from "@/components/sistema/PorCategoria";
import { Bandeja, type CategoriaChip, type ItemBandeja } from "./Bandeja";
import { TotalizadorMes } from "./TotalizadorMes";
import { Filtros } from "./Filtros";
import { Historial } from "./Historial";
import { miembrosDelHogar, movimientosFiltrados } from "./datos";

// Pantalla 05 — Movimientos + bandeja (DESIGN_AUDIT.md §1.7, §3.7/3.8).
// Server Component: lee searchParams, filtra en el server y pasa props planas.

type ParametrosBusqueda = Record<string, string | string[] | undefined>;

function uno(valor: string | string[] | undefined): string | undefined {
  return typeof valor === "string" && valor !== "" ? valor : undefined;
}

function comoUuid(valor: string | undefined): string | undefined {
  return valor && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor)
    ? valor
    : undefined;
}

function comoAmbito(valor: string | undefined): "hogar" | "personal" | undefined {
  return valor === "hogar" || valor === "personal" ? valor : undefined;
}

function comoMedio(
  valor: string | undefined,
): { tipo: "cuenta" | "tarjeta"; id: string } | undefined {
  if (!valor) return undefined;
  const [tipo, id] = valor.split(":");
  if ((tipo !== "cuenta" && tipo !== "tarjeta") || !comoUuid(id)) return undefined;
  return { tipo, id };
}

function comoTipo(valor: string | undefined): "gasto" | "ingreso" | undefined {
  return valor === "gasto" || valor === "ingreso" ? valor : undefined;
}

const soloChip = ({ id, nombre, icono, grupo }: { id: string; nombre: string; icono: string; grupo: string }) =>
  ({ id, nombre, icono, grupo }) satisfies CategoriaChip;

export default async function PaginaMovimientos({
  searchParams,
}: {
  searchParams: Promise<ParametrosBusqueda>;
}) {
  const parametros = await searchParams;
  const q = uno(parametros.q);
  const ambito = comoAmbito(uno(parametros.ambito));
  const medio = comoMedio(uno(parametros.medio));
  const categoriaId = comoUuid(uno(parametros.categoria));
  const miembroId = comoUuid(uno(parametros.miembro));
  const tipo = comoTipo(uno(parametros.tipo));
  const vista = uno(parametros.vista) === "categorias" ? "categorias" : "lista";

  const sesion = await obtenerSesionHogar();
  const hoy = hoyBA();
  const mesActual = mesDe(hoy);
  const mes = mesDesdeParametro(uno(parametros.mes)) ?? mesActual;
  const esMesActual = mes === mesActual;

  const totalesPedido = totalesDelMes(sesion, mes);
  // se pide solo en su solapa: es una consulta más y en "Lista" no se usa
  const porCategoria =
    vista === "categorias" ? await gastosPorCategoria(sesion, mes) : [];
  const [bandeja, historial, categorias, medios, miembros, recientesHogar, recientesPersonal] =
    await Promise.all([
      bandejaDeEntrada(sesion),
      movimientosFiltrados(sesion, { buscar: q, ambito, categoriaId, miembroId, medio, tipo, mes }),
      categoriasDelHogar(sesion),
      mediosDePago(sesion),
      miembrosDelHogar(sesion),
      categoriasRecientes(sesion, "hogar"),
      categoriasRecientes(sesion, "personal"),
    ]);

  const itemsBandeja: ItemBandeja[] = bandeja.map((m) => ({
    id: m.id,
    descripcion: m.descripcion,
    importeCentavos: m.importeCentavos,
    esIngreso: m.tipo === "ingreso",
    meta: [etiquetaDia(m.fecha, hoy).toLowerCase(), m.medio].filter(Boolean).join(" · "),
    ambito: m.visibilidad === "compartido" ? "hogar" : "personal",
  }));

  // historial agrupado por día (viene ordenado por fecha desc)
  const dias: Array<{ fecha: string; movimientos: MovimientoLista[] }> = [];
  for (const m of historial) {
    const ultimo = dias[dias.length - 1];
    if (ultimo && ultimo.fecha === m.fecha) ultimo.movimientos.push(m);
    else dias.push({ fecha: m.fecha, movimientos: [m] });
  }

  const hayFiltros = Boolean(q || ambito || medio || categoriaId || miembroId || tipo);
  // suma bruta de lo filtrado: los importes son absolutos (el signo lo lleva
  // el tipo), así que esto no netea ingresos contra gastos — cuánto es lo visto
  const totalFiltradoCentavos = historial.reduce((suma, m) => suma + m.importeCentavos, 0);

  // lo que hay que arrastrar al cambiar de mes o de solapa
  const comunes: Record<string, string> = Object.fromEntries(
    Object.entries({
      q,
      ambito,
      medio: medio ? `${medio.tipo}:${medio.id}` : undefined,
      categoria: categoriaId,
      miembro: miembroId,
      tipo,
      ...(mes === mesActual ? {} : { mes: mes.slice(0, 7) }),
    }).filter((par): par is [string, string] => par[1] !== undefined),
  );
  const hrefVista = (v: string) => {
    const params = new URLSearchParams(comunes);
    if (v !== "lista") params.set("vista", v);
    const cadena = params.toString();
    return `/movimientos${cadena ? `?${cadena}` : ""}`;
  };
  const inicial = (sesion.nombreMiembro[0] ?? "?").toUpperCase();

  return (
    <div className="px-5 pt-14">
      <header className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold">Movimientos</h1>
        <Link
          href="/hogar"
          aria-label="Hogar"
          className="hit-44 flex size-[34px] items-center justify-center rounded-full bg-tinta text-[14px] font-semibold text-papel"
        >
          {inicial}
        </Link>
      </header>

      <NavegadorMes
        mes={mes}
        mesActual={mesActual}
        ruta="/movimientos"
        otrosParametros={{
          ...comunes,
          ...(vista === "categorias" ? { vista } : {}),
        }}
      />

      {/* Lista / por categoría: EL MISMO par de íconos que Presupuesto. Es la
          misma pregunta ("¿cómo miro esto?") y dibujarla acá como solapas de
          texto de ancho completo la hacía parecer otra cosa —y se comía una
          banda entera de alto arriba del totalizador. */}
      <nav
        aria-label="Vista"
        className="mt-3 ml-auto flex w-fit rounded-[11px] bg-fondo-segmented p-[2px]"
      >
        <Link
          href={hrefVista("lista")}
          aria-label="Ver lista"
          aria-current={vista === "lista" ? "true" : undefined}
          className={`flex h-[33px] w-11 items-center justify-center rounded-[9px] ${
            vista === "lista"
              ? "bg-segmented-activo text-tinta shadow-thumb"
              : "text-tinta-secundaria"
          }`}
        >
          <List className="size-[17px]" strokeWidth={1.8} aria-hidden />
        </Link>
        <Link
          href={hrefVista("categorias")}
          aria-label="Ver por categoría"
          aria-current={vista === "categorias" ? "true" : undefined}
          className={`flex h-[33px] w-11 items-center justify-center rounded-[9px] ${
            vista === "categorias"
              ? "bg-segmented-activo text-tinta shadow-thumb"
              : "text-tinta-secundaria"
          }`}
        >
          <ChartPie className="size-[17px]" strokeWidth={1.8} aria-hidden />
        </Link>
      </nav>

      {/* Totalizador del mes: lo que entró, lo que salió y el saldo entre ambos.
          No es el "disponible" del presupuesto (eso vive en Resumen): es caja. */}
      <TotalizadorMes totales={await totalesPedido} />

      {vista === "categorias" ? (
        <PorCategoria
          items={porCategoria}
          totalGastosCentavos={(await totalesPedido).gastosCentavos}
          vacio={`No cargaste gastos en ${formatearMesLargo(mes)}. Cuando cargues alguno, acá vas a ver en qué se te fue.`}
        />
      ) : (
        <>
      <div className="mt-4">
        <Filtros
          q={q ?? ""}
          ambito={ambito ?? null}
          medio={medio ? `${medio.tipo}:${medio.id}` : null}
          categoria={categoriaId ?? null}
          miembro={miembroId ?? null}
          tipo={tipo ?? null}
          medios={medios.map((m) => ({ valor: `${m.tipo}:${m.id}`, etiqueta: m.etiqueta }))}
          categorias={categorias.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
          miembros={miembros.map((m) => ({ valor: m.userId, etiqueta: m.nombre }))}
        />
      </div>

      {/* Con filtros activos, cuánto suma lo que quedó a la vista. El
          TotalizadorMes de arriba sigue midiendo el mes completo. */}
      {hayFiltros && historial.length > 0 && (
        <p className="mt-3 text-[11.5px] text-tinta-secundaria">
          <span className="cifra">{historial.length}</span>{" "}
          {historial.length === 1 ? "movimiento" : "movimientos"} ·{" "}
          <span className="cifra">{formatearImporte(totalFiltradoCentavos)}</span>
        </p>
      )}

      {/* La bandeja se corre al filtrar por tipo (el historial ya muestra todo
          ese tipo, incluido lo sin categorizar) y también fuera del mes en
          curso: es una lista de PENDIENTES, no un corte histórico — verla
          mientras mirás mayo haría pensar que esos movimientos son de mayo. */}
      {itemsBandeja.length > 0 && !tipo && esMesActual && (
        <div className="mt-4">
          <Bandeja
            items={itemsBandeja}
            sugeridas={{
              hogar: recientesHogar.slice(0, 3).map(soloChip),
              personal: recientesPersonal.slice(0, 3).map(soloChip),
            }}
            categorias={{
              hogar: categorias.filter((c) => c.ambito === "hogar").map(soloChip),
              personal: categorias.filter((c) => c.ambito === "personal").map(soloChip),
            }}
          />
        </div>
      )}

      <Historial dias={dias} hoy={hoy} categorias={categorias} medios={medios} />
        </>
      )}

      {historial.length === 0 && (
        <p className="mt-8 text-center text-[13.5px] leading-[1.55] text-tinta-secundaria">
          {hayFiltros
            ? "No encontramos movimientos con esos filtros."
            : "Todavía no hay movimientos. Cargá el primero con el +."}
        </p>
      )}
    </div>
  );
}
