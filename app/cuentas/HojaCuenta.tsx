"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Landmark, TrendingUp, Wallet } from "lucide-react";
import { desactivarMedio, guardarCuenta, reactivarMedio } from "@/app/acciones/cuentas";
import { Badge } from "@/components/sistema/Badge";
import { BotonPrimario } from "@/components/sistema/BotonPrimario";
import { Card, EncabezadoSeccion } from "@/components/sistema/Card";
import { Chip } from "@/components/sistema/Chip";
import { HojaInferior } from "@/components/sistema/HojaInferior";

// Sección "Cuentas" de /cuentas (hueco declarado, DESIGN_AUDIT §5: "la
// gestión de cuentas"): lista de filas + hoja de alta/edición. Sin diseño en
// el export: sigue el sistema — chips de selección en tinta (§3.3), badges de
// ámbito (§3.1), sin borrado físico (desactivar).

export type TipoCuenta = "efectivo" | "banco" | "billetera" | "inversion";

export type CuentaFila = {
  id: string;
  nombre: string;
  tipo: TipoCuenta;
  moneda: "ARS" | "USD";
  visibilidad: "personal" | "compartido";
  activa: boolean;
};

const TIPOS: Array<{ valor: TipoCuenta; etiqueta: string }> = [
  { valor: "efectivo", etiqueta: "Efectivo" },
  { valor: "banco", etiqueta: "Banco" },
  { valor: "billetera", etiqueta: "Billetera" },
  { valor: "inversion", etiqueta: "Inversión" },
];

const ICONO_TIPO = {
  efectivo: Banknote,
  banco: Landmark,
  billetera: Wallet,
  inversion: TrendingUp,
} as const;

const ETIQUETA_TIPO: Record<TipoCuenta, string> = {
  efectivo: "efectivo",
  banco: "banco",
  billetera: "billetera",
  inversion: "inversión",
};

export const claseInput =
  "h-12 rounded-cta border border-borde bg-superficie px-3.5 text-[15px] text-tinta placeholder:text-tinta-terciaria";

export function SeccionCuentas({ cuentas }: { cuentas: CuentaFila[] }) {
  const [editando, setEditando] = useState<CuentaFila | null>(null);
  const [abierta, setAbierta] = useState(false);
  // bump por apertura: resetea el estado del form vía key
  const [version, setVersion] = useState(0);

  function abrirNueva() {
    setEditando(null);
    setVersion((v) => v + 1);
    setAbierta(true);
  }

  function abrirEdicion(cuenta: CuentaFila) {
    setEditando(cuenta);
    setVersion((v) => v + 1);
    setAbierta(true);
  }

  return (
    <>
      <EncabezadoSeccion>Cuentas</EncabezadoSeccion>
      <Card className="divide-y divide-separador">
        {cuentas.map((c) => {
          const Icono = ICONO_TIPO[c.tipo];
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => abrirEdicion(c)}
              aria-label={`Editar cuenta ${c.nombre}`}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <Icono
                className={`size-[18px] shrink-0 ${
                  c.activa ? "text-tinta-secundaria" : "text-tinta-terciaria"
                }`}
                strokeWidth={1.5}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-[14px] font-medium ${
                    c.activa ? "text-tinta" : "text-tinta-terciaria"
                  }`}
                >
                  {c.nombre}
                </span>
                <span
                  className={`block text-[11px] ${
                    c.activa ? "text-tinta-secundaria" : "text-tinta-terciaria"
                  }`}
                >
                  {ETIQUETA_TIPO[c.tipo]} · {c.moneda}
                </span>
              </span>
              {c.activa ? (
                <Badge variante={c.visibilidad === "personal" ? "personal" : "hogar"}>
                  {c.visibilidad === "personal" ? "personal" : "hogar"}
                </Badge>
              ) : (
                <Badge variante="neutro">inactiva</Badge>
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={abrirNueva}
          className="hit-44 w-full px-4 py-3 text-left text-[13px] font-medium text-verde"
        >
          Agregar cuenta →
        </button>
      </Card>

      <HojaInferior
        abierta={abierta}
        onCerrar={() => setAbierta(false)}
        titulo={editando ? "Editar cuenta" : "Nueva cuenta"}
      >
        <FormCuenta key={version} cuenta={editando} alListo={() => setAbierta(false)} />
      </HojaInferior>
    </>
  );
}

function FormCuenta({
  cuenta,
  alListo,
}: {
  cuenta: CuentaFila | null;
  alListo: () => void;
}) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [nombre, setNombre] = useState(cuenta?.nombre ?? "");
  const [tipo, setTipo] = useState<TipoCuenta>(cuenta?.tipo ?? "banco");
  const [moneda, setMoneda] = useState<"ARS" | "USD">(cuenta?.moneda ?? "ARS");
  const [visibilidad, setVisibilidad] = useState<"personal" | "compartido">(
    cuenta?.visibilidad ?? "compartido",
  );
  const [error, setError] = useState<string | null>(null);

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente || nombre.trim() === "") return;
    setError(null);
    iniciarTransicion(async () => {
      const r = await guardarCuenta({
        cuentaId: cuenta?.id ?? null,
        nombre,
        tipo,
        moneda,
        visibilidad,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      alListo();
      router.refresh();
    });
  }

  function alternarActiva() {
    if (!cuenta || pendiente) return;
    setError(null);
    iniciarTransicion(async () => {
      const accion = cuenta.activa ? desactivarMedio : reactivarMedio;
      const r = await accion({ id: cuenta.id, tabla: "cuentas" });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      alListo();
      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-tinta-secundaria">Nombre</span>
        <input
          type="text"
          required
          maxLength={40}
          autoComplete="off"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Cuenta sueldo"
          className={claseInput}
        />
      </label>

      <fieldset>
        <legend className="text-[12px] font-medium text-tinta-secundaria">Tipo</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {TIPOS.map((t) => (
            <Chip
              key={t.valor}
              seleccionado={tipo === t.valor}
              onClick={() => setTipo(t.valor)}
            >
              {t.etiqueta}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-[12px] font-medium text-tinta-secundaria">Moneda</legend>
        <div className="mt-1.5 flex gap-2">
          {(["ARS", "USD"] as const).map((m) => (
            <Chip key={m} seleccionado={moneda === m} onClick={() => setMoneda(m)}>
              {m}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-[12px] font-medium text-tinta-secundaria">Visibilidad</legend>
        <div className="mt-1.5 flex gap-2">
          <Chip
            seleccionado={visibilidad === "compartido"}
            onClick={() => setVisibilidad("compartido")}
          >
            Hogar
          </Chip>
          <Chip
            seleccionado={visibilidad === "personal"}
            onClick={() => setVisibilidad("personal")}
          >
            Personal
          </Chip>
        </div>
        <p className="mt-1.5 text-[11px] text-tinta-secundaria">
          Lo personal solo lo ves vos.
        </p>
      </fieldset>

      {error && (
        <p role="alert" className="text-[12.5px] font-medium text-rojo">
          {error}
        </p>
      )}

      <BotonPrimario type="submit" disabled={pendiente || nombre.trim() === ""}>
        {pendiente ? "Guardando…" : "Guardar"}
      </BotonPrimario>

      {cuenta && (
        <div className="text-center">
          <button
            type="button"
            onClick={alternarActiva}
            disabled={pendiente}
            className={`hit-44 text-[13px] font-medium disabled:opacity-60 ${
              cuenta.activa ? "text-rojo" : "text-verde"
            }`}
          >
            {cuenta.activa ? "Desactivar" : "Reactivar"}
          </button>
          <p className="mt-1 text-[11px] text-tinta-secundaria">
            {cuenta.activa
              ? "Sin borrado: deja de aparecer para elegir, el historial queda."
              : "Vuelve a aparecer para elegir en toda la app."}
          </p>
        </div>
      )}
    </form>
  );
}
