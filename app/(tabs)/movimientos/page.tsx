import Link from "next/link";
import {
  bandejaDeEntrada,
  categoriasDelHogar,
  categoriasRecientes,
  mediosDePago,
  type MovimientoLista,
} from "@/lib/datos/movimientos";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { etiquetaDia, hoyBA } from "@/lib/dominio/fechas";
import { Bandeja, type CategoriaChip, type ItemBandeja } from "./Bandeja";
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

const soloChip = ({ id, nombre, icono }: { id: string; nombre: string; icono: string }) =>
  ({ id, nombre, icono }) satisfies CategoriaChip;

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

  const sesion = await obtenerSesionHogar();
  const hoy = hoyBA();

  const [bandeja, historial, categorias, medios, miembros, recientesHogar, recientesPersonal] =
    await Promise.all([
      bandejaDeEntrada(sesion),
      movimientosFiltrados(sesion, { buscar: q, ambito, categoriaId, miembroId, medio, tipo }),
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

      {/* la bandeja se corre al filtrar por tipo: el historial ya muestra todo
          ese tipo (incluido lo sin categorizar) y así no se duplica */}
      {itemsBandeja.length > 0 && !tipo && (
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

      <Historial dias={dias} hoy={hoy} />

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
