"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { desactivarMedio, guardarTarjeta } from "@/app/acciones/cuentas";
import { Badge } from "@/components/sistema/Badge";
import { BotonPrimario } from "@/components/sistema/BotonPrimario";
import { Card, EncabezadoSeccion } from "@/components/sistema/Card";
import { Chip } from "@/components/sistema/Chip";
import { HojaInferior } from "@/components/sistema/HojaInferior";
import { claseInput } from "./HojaCuenta";

// Sección "Tarjetas" de /cuentas (hueco declarado, DESIGN_AUDIT §5). Formato
// de tarjeta del export (§2.5): "Visa •• 4321", últimos 4 en mono (.cifra).

export type RedTarjeta = "visa" | "mastercard" | "amex" | "otra";

export type TarjetaFila = {
  id: string;
  nombre: string;
  banco: string;
  red: RedTarjeta;
  ultimos4: string;
  visibilidad: "personal" | "compartido";
  activa: boolean;
};

const REDES: Array<{ valor: RedTarjeta; etiqueta: string }> = [
  { valor: "visa", etiqueta: "Visa" },
  { valor: "mastercard", etiqueta: "Mastercard" },
  { valor: "amex", etiqueta: "Amex" },
  { valor: "otra", etiqueta: "Otra" },
];

const ETIQUETA_RED: Record<RedTarjeta, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  otra: "Otra",
};

export function SeccionTarjetas({ tarjetas }: { tarjetas: TarjetaFila[] }) {
  const [editando, setEditando] = useState<TarjetaFila | null>(null);
  const [abierta, setAbierta] = useState(false);
  // bump por apertura: resetea el estado del form vía key
  const [version, setVersion] = useState(0);

  function abrirNueva() {
    setEditando(null);
    setVersion((v) => v + 1);
    setAbierta(true);
  }

  function abrirEdicion(tarjeta: TarjetaFila) {
    setEditando(tarjeta);
    setVersion((v) => v + 1);
    setAbierta(true);
  }

  return (
    <>
      <EncabezadoSeccion>Tarjetas</EncabezadoSeccion>
      <Card className="divide-y divide-separador">
        {tarjetas.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => abrirEdicion(t)}
            aria-label={`Editar tarjeta ${t.nombre} terminada en ${t.ultimos4}`}
            className="flex w-full items-center gap-3 px-4 py-3 text-left"
          >
            <CreditCard
              className={`size-[18px] shrink-0 ${
                t.activa ? "text-tinta-secundaria" : "text-tinta-terciaria"
              }`}
              strokeWidth={1.5}
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span
                className={`block truncate text-[14px] font-medium ${
                  t.activa ? "text-tinta" : "text-tinta-terciaria"
                }`}
              >
                {t.nombre} <span className="cifra">•• {t.ultimos4}</span>
              </span>
              <span
                className={`block truncate text-[11px] ${
                  t.activa ? "text-tinta-secundaria" : "text-tinta-terciaria"
                }`}
              >
                {ETIQUETA_RED[t.red]} · {t.banco}
              </span>
            </span>
            {t.activa ? (
              <Badge variante={t.visibilidad === "personal" ? "personal" : "hogar"}>
                {t.visibilidad === "personal" ? "personal" : "hogar"}
              </Badge>
            ) : (
              <Badge variante="neutro">inactiva</Badge>
            )}
          </button>
        ))}

        <button
          type="button"
          onClick={abrirNueva}
          className="hit-44 w-full px-4 py-3 text-left text-[13px] font-medium text-verde"
        >
          Agregar tarjeta →
        </button>
      </Card>

      <HojaInferior
        abierta={abierta}
        onCerrar={() => setAbierta(false)}
        titulo={editando ? "Editar tarjeta" : "Nueva tarjeta"}
      >
        <FormTarjeta key={version} tarjeta={editando} alListo={() => setAbierta(false)} />
      </HojaInferior>
    </>
  );
}

function FormTarjeta({
  tarjeta,
  alListo,
}: {
  tarjeta: TarjetaFila | null;
  alListo: () => void;
}) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [nombre, setNombre] = useState(tarjeta?.nombre ?? "");
  const [banco, setBanco] = useState(tarjeta?.banco ?? "");
  const [red, setRed] = useState<RedTarjeta>(tarjeta?.red ?? "visa");
  const [ultimos4, setUltimos4] = useState(tarjeta?.ultimos4 ?? "");
  const [visibilidad, setVisibilidad] = useState<"personal" | "compartido">(
    tarjeta?.visibilidad ?? "compartido",
  );
  const [error, setError] = useState<string | null>(null);

  const valida = nombre.trim() !== "" && banco.trim() !== "" && ultimos4.length === 4;

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente || !valida) return;
    setError(null);
    iniciarTransicion(async () => {
      const r = await guardarTarjeta({
        tarjetaId: tarjeta?.id ?? null,
        nombre,
        banco,
        red,
        ultimos4,
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

  function desactivar() {
    if (!tarjeta || pendiente) return;
    setError(null);
    iniciarTransicion(async () => {
      const r = await desactivarMedio({ id: tarjeta.id, tabla: "tarjetas" });
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
          placeholder="Visa Galicia"
          className={claseInput}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-tinta-secundaria">Banco</span>
        <input
          type="text"
          required
          maxLength={40}
          autoComplete="off"
          value={banco}
          onChange={(e) => setBanco(e.target.value)}
          placeholder="Banco Galicia"
          className={claseInput}
        />
      </label>

      <fieldset>
        <legend className="text-[12px] font-medium text-tinta-secundaria">Red</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {REDES.map((r) => (
            <Chip key={r.valor} seleccionado={red === r.valor} onClick={() => setRed(r.valor)}>
              {r.etiqueta}
            </Chip>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-tinta-secundaria">Últimos 4 dígitos</span>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          required
          autoComplete="off"
          value={ultimos4}
          onChange={(e) => setUltimos4(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="4321"
          className={`cifra ${claseInput}`}
        />
      </label>

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

      <BotonPrimario type="submit" disabled={pendiente || !valida}>
        {pendiente ? "Guardando…" : "Guardar"}
      </BotonPrimario>

      {tarjeta && (
        <div className="text-center">
          <button
            type="button"
            onClick={desactivar}
            disabled={pendiente}
            className="hit-44 text-[13px] font-medium text-rojo disabled:opacity-60"
          >
            Desactivar
          </button>
          <p className="mt-1 text-[11px] text-tinta-secundaria">
            Sin borrado: deja de aparecer para elegir, el historial queda.
          </p>
        </div>
      )}
    </form>
  );
}
