"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import {
  conectarGmail,
  desconectarGmail,
  sincronizarGmail,
} from "@/app/acciones/gmail";
import { Card, EncabezadoSeccion } from "@/components/sistema/Card";
import { formatearDiaCorto } from "@/lib/dominio/fechas";

// Conexión con Gmail (opción A): estados sin conectar / conectada, búsqueda
// manual de los últimos 50 mails y desconexión en dos taps (con auto-reset).
// El aviso de la vuelta del OAuth (?gmail=...) llega resuelto desde el server.

type Props = {
  conexion: { email: string; ultimaSincronizacion: string | null } | null;
  pendientes: number;
  aviso: string | null;
};

export function ConexionGmail({ conexion, pendientes, aviso }: Props) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [accion, setAccion] = useState<"sincronizar" | "desconectar" | null>(null);
  // conectar hace redirect externo a Google: el useTransition quedaría colgado,
  // así que uso un estado propio que puedo resetear al volver con Back (bfcache)
  const [abriendo, setAbriendo] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(aviso);
  const [confirmarDesconexion, setConfirmarDesconexion] = useState(false);

  // limpio el ?gmail=... de la URL (el aviso ya quedó en estado): así al recargar
  // o volver con Back el error viejo no reaparece pegado a la URL
  useEffect(() => {
    if (aviso) router.replace("/cuentas");
  }, [aviso, router]);

  // volver con Back desde el consentimiento de Google restaura la página del
  // bfcache con el botón congelado en "Abriendo Google…": lo destrabo
  useEffect(() => {
    const alMostrar = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setAbriendo(false);
        setConfirmarDesconexion(false);
      }
    };
    window.addEventListener("pageshow", alMostrar);
    return () => window.removeEventListener("pageshow", alMostrar);
  }, []);

  // el "¿Desconectar?" se cancela solo a los 4s si no se confirma
  useEffect(() => {
    if (!confirmarDesconexion) return;
    const t = setTimeout(() => setConfirmarDesconexion(false), 4000);
    return () => clearTimeout(t);
  }, [confirmarDesconexion]);

  function conectar() {
    setError(null);
    setAbriendo(true);
    iniciar(async () => {
      const r = await conectarGmail();
      // si la acción vuelve es porque falló (el éxito redirige a Google)
      if (r && !r.ok) {
        setError(r.error);
        setAbriendo(false);
      }
    });
  }

  function sincronizar() {
    setError(null);
    setResultado(null);
    setAccion("sincronizar");
    iniciar(async () => {
      const r = await sincronizarGmail();
      if (r.ok) {
        setResultado(
          r.nuevas === 0
            ? `Nada nuevo entre los últimos ${r.revisados} mails.`
            : r.nuevas === 1
              ? "1 sugerencia nueva."
              : `${r.nuevas} sugerencias nuevas.`,
        );
        router.refresh();
      } else {
        setError(r.error);
      }
      setAccion(null);
    });
  }

  function desconectar() {
    if (!confirmarDesconexion) {
      setConfirmarDesconexion(true);
      return;
    }
    setError(null);
    setAccion("desconectar");
    iniciar(async () => {
      const r = await desconectarGmail();
      if (!r.ok) setError(r.error);
      setConfirmarDesconexion(false);
      setAccion(null);
      router.refresh();
    });
  }

  const ultima = conexion?.ultimaSincronizacion
    ? formatearDiaCorto(conexion.ultimaSincronizacion.slice(0, 10))
    : null;

  return (
    <section>
      <EncabezadoSeccion>Conexiones</EncabezadoSeccion>
      <Card className="px-3.5 py-3.5">
        <div className="flex items-center gap-[11px]">
          <Mail className="size-[18px] shrink-0 text-tinta-secundaria" strokeWidth={1.5} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-medium text-tinta">Gmail</p>
            <p className="mt-[2px] truncate text-[11px] text-tinta-secundaria">
              {conexion
                ? conexion.email
                : "Sumá tus avisos de consumo como sugerencias"}
            </p>
          </div>
          {conexion && (
            <button
              type="button"
              onClick={desconectar}
              disabled={pendiente}
              className={`hit-44 shrink-0 text-[12px] font-medium disabled:opacity-60 ${
                confirmarDesconexion ? "text-rojo" : "text-tinta-secundaria"
              }`}
            >
              {confirmarDesconexion ? "¿Desconectar?" : "Desconectar"}
            </button>
          )}
        </div>

        {conexion ? (
          <>
            <button
              type="button"
              onClick={sincronizar}
              disabled={pendiente}
              className="mt-3 w-full rounded-cta border border-verde py-2.5 text-[13.5px] font-semibold text-verde disabled:opacity-60"
            >
              {accion === "sincronizar" ? "Buscando…" : "Buscar movimientos en los últimos 50 mails"}
            </button>
            {resultado ? (
              <p className="mt-2 text-center text-[12px] text-tinta-secundaria">{resultado}</p>
            ) : (
              ultima && (
                <p className="mt-2 text-center text-[11px] text-tinta-terciaria">
                  Última búsqueda: {ultima}
                </p>
              )
            )}
            {pendientes > 0 && (
              <Link
                href="/sugerencias"
                className="mt-2 block text-center text-[12.5px] font-medium text-verde"
              >
                Revisar {pendientes === 1 ? "1 sugerencia pendiente" : `${pendientes} sugerencias pendientes`} →
              </Link>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={conectar}
            disabled={abriendo}
            className="mt-3 w-full rounded-cta border border-verde py-2.5 text-[13.5px] font-semibold text-verde disabled:opacity-60"
          >
            {abriendo ? "Abriendo Google…" : "Conectar Gmail"}
          </button>
        )}

        {error && (
          <p role="alert" className="mt-2 text-center text-[12px] font-medium text-rojo">
            {error}
          </p>
        )}
        <p className="mt-2.5 text-[10.5px] leading-[1.5] text-tinta-terciaria">
          Solo lectura: la app no puede escribir ni borrar tu correo. Se revisan
          los últimos 50 mails y nada se agrega sin tu confirmación.
        </p>
      </Card>
    </section>
  );
}
