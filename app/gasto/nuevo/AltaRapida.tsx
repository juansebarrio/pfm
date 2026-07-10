"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CreditCard, X } from "lucide-react";
import { crearGasto } from "@/app/acciones/movimientos";
import { Badge } from "@/components/sistema/Badge";
import { BotonPrimario } from "@/components/sistema/BotonPrimario";
import { Chip } from "@/components/sistema/Chip";
import { IconoCategoria } from "@/components/sistema/IconoCategoria";
import { Importe } from "@/components/sistema/Importe";
import { TecladoNumerico } from "@/components/sistema/TecladoNumerico";
import type { CategoriaSimple, MedioDePago } from "@/lib/datos/movimientos";
import { formatearDiaCorto } from "@/lib/dominio/fechas";

// Alta rápida (03): de tocar + a guardado en menos de 10 segundos.
// El monto vive como string (entero + decimales) y se convierte a centavos
// con aritmética entera: ningún float toca plata. Ámbito y medio se
// recuerdan en localStorage ("sobres.ambito" / "sobres.medio").

type Ambito = "hogar" | "personal";
type Cuotas = 1 | 3 | 6 | 12;

const OPCIONES_CUOTAS: readonly Cuotas[] = [1, 3, 6, 12];
const CLAVE_AMBITO = "sobres.ambito";
const CLAVE_MEDIO = "sobres.medio";
// tope de tecleo: $ 999.999.999 (por debajo del máximo del esquema de la action)
const MAX_DIGITOS_ENTERO = 9;

type Props = {
  medios: MedioDePago[];
  categoriasHogar: CategoriaSimple[];
  categoriasPersonales: CategoriaSimple[];
};

export function AltaRapida({ medios, categoriasHogar, categoriasPersonales }: Props) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();

  const [ambito, setAmbito] = useState<Ambito>("hogar");
  const [medioId, setMedioId] = useState<string | null>(medios[0]?.id ?? null);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [cuotas, setCuotas] = useState<Cuotas>(1);
  const [error, setError] = useState<string | null>(null);

  // Monto tecleado: pesos enteros + decimales en curso (null = sin coma).
  const [entero, setEntero] = useState("");
  const [decimales, setDecimales] = useState<string | null>(null);

  // Última elección recordada — después de montar, para no romper la hidratación.
  useEffect(() => {
    const a = window.localStorage.getItem(CLAVE_AMBITO);
    if (a === "hogar" || a === "personal") setAmbito(a);
    const m = window.localStorage.getItem(CLAVE_MEDIO);
    if (m && medios.some((x) => x.id === m)) setMedioId(m);
  }, [medios]);

  const medio = medios.find((m) => m.id === medioId);
  const enteroCentavos = Number(entero || "0") * 100;
  const centavos = enteroCentavos + (decimales ? Number(decimales.padEnd(2, "0")) : 0);
  const categorias = ambito === "hogar" ? categoriasHogar : categoriasPersonales;

  // updates funcionales: taps consecutivos en el mismo tick no se pisan
  function tocarDigito(digito: string) {
    if (decimales !== null) {
      setDecimales((d) => (d !== null && d.length < 2 ? d + digito : d));
      return;
    }
    setEntero((e) =>
      e.length >= MAX_DIGITOS_ENTERO ? e : e === "0" ? digito : e + digito,
    );
  }

  function tocarComa() {
    if (decimales !== null) return;
    setEntero((e) => (e === "" ? "0" : e));
    setDecimales("");
  }

  function tocarBorrar() {
    if (decimales !== null) {
      setDecimales((d) => (d !== null && d.length > 0 ? d.slice(0, -1) : null));
      return;
    }
    setEntero((e) => e.slice(0, -1));
  }

  function elegirAmbito(a: Ambito) {
    setAmbito(a);
    setCategoriaId(null); // la categoría pertenece al ámbito
    window.localStorage.setItem(CLAVE_AMBITO, a);
  }

  function elegirMedio(m: MedioDePago) {
    setMedioId(m.id);
    if (m.tipo !== "tarjeta") setCuotas(1);
    window.localStorage.setItem(CLAVE_MEDIO, m.id);
  }

  function alternarCategoria(id: string) {
    setCategoriaId(categoriaId === id ? null : id);
  }

  function guardar() {
    if (!medio || centavos <= 0 || pendiente) return;
    setError(null);
    iniciarTransicion(async () => {
      const resultado = await crearGasto({
        importeCentavos: centavos,
        medioTipo: medio.tipo,
        medioId: medio.id,
        categoriaId,
        ambito,
        cuotas: medio.tipo === "tarjeta" ? cuotas : 1,
      });
      if (resultado.ok) {
        router.push("/movimientos");
      } else {
        setError(resultado.error);
      }
    });
  }

  return (
    <div className="flex min-h-dvh flex-col px-5 pt-14">
      {/* Header modal compacto (§3.17.4): X + título 16px + segmented mini */}
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Cerrar"
          className="hit-44 text-tinta"
        >
          <X className="size-[22px]" strokeWidth={2} aria-hidden />
        </button>
        <h1 className="flex-1 text-[16px] font-semibold">Nuevo gasto</h1>
        <SegmentedMini valor={ambito} onCambio={elegirAmbito} />
      </header>

      {/* Monto protagonista: 52px, la tipografía más grande del sistema */}
      <div className="mt-7 text-center" aria-live="polite">
        <Importe centavos={enteroCentavos} variante="hero-alta" />
        {decimales !== null && (
          // espejo exacto de la variante hero-alta de <Importe> para la coma en curso
          <span className="cifra text-[52px] font-medium tracking-[-0.03em]">,{decimales}</span>
        )}
      </div>

      {/* Chips de medio de pago con fade en el borde derecho */}
      <div
        role="group"
        aria-label="Medio de pago"
        className="-mx-5 mt-6 flex gap-2 overflow-x-auto px-5 py-1 [mask-image:linear-gradient(to_right,#000_calc(100%_-_32px),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {medios.map((m) => (
          <Chip
            key={m.id}
            escala="medio"
            seleccionado={m.id === medioId}
            onClick={() => elegirMedio(m)}
          >
            {m.tipo === "tarjeta" && (
              <CreditCard className="size-3.5" strokeWidth={1.5} aria-hidden />
            )}
            {m.etiqueta}
          </Chip>
        ))}
      </div>

      {/* Card contextual de tarjeta: ciclo + cuotas (solo con tarjeta, §3.11) */}
      {medio?.tipo === "tarjeta" && (
        <div className="mt-3 rounded-cta border border-borde bg-superficie px-3.5 py-3">
          {medio.cicloCierre && (
            <div className="flex items-center gap-2">
              <CalendarDays
                className="size-[15px] shrink-0 text-tinta-secundaria"
                strokeWidth={1.5}
                aria-hidden
              />
              <p className="flex-1 text-[12.5px] text-tinta">
                Cae en el ciclo que cierra el{" "}
                <span className="font-semibold">{formatearDiaCorto(medio.cicloCierre)}</span>
              </p>
              <Badge variante={medio.cicloEstado === "confirmado" ? "confirmada" : "estimada"}>
                {medio.cicloEstado === "confirmado" ? "confirmada" : "estimada"}
              </Badge>
            </div>
          )}
          <div
            role="group"
            aria-label="Cuotas"
            className={`flex items-center gap-2 ${
              medio.cicloCierre ? "mt-2.5 border-t border-separador pt-[9px]" : ""
            }`}
          >
            <span className="flex-1 text-[12px] text-tinta-secundaria">Cuotas</span>
            {OPCIONES_CUOTAS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={cuotas === n}
                onClick={() => setCuotas(n)}
                className={`cifra hit-44 w-11 rounded-chip-chico border py-[7px] text-[13px] transition-colors ${
                  cuotas === n
                    ? "border-tinta bg-tinta font-semibold text-papel"
                    : "border-borde bg-superficie font-medium text-tinta"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Picker de categorías recientes del ámbito activo (§3.12) */}
      {categorias.length > 0 && (
        <section className="mt-5">
          <p className="text-[12px] text-tinta-secundaria">¿En qué lo gastaste? · opcional</p>
          <div className="mt-2 grid grid-cols-4 gap-[7px]">
            {categorias.map((c) => {
              const seleccionada = c.id === categoriaId;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={seleccionada}
                  onClick={() => alternarCategoria(c.id)}
                  className={`flex flex-col items-center gap-1 rounded-cta px-0.5 py-[9px] transition-colors ${
                    seleccionada
                      ? "border-[1.5px] border-verde bg-verde-suave"
                      : "border border-borde bg-superficie"
                  }`}
                >
                  <IconoCategoria nombre={c.icono} tono={seleccionada ? "verde" : "normal"} />
                  <span
                    className={`max-w-full truncate text-[10px] ${
                      seleccionada ? "font-semibold text-verde" : "font-medium text-tinta"
                    }`}
                  >
                    {c.nombre}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Teclado + CTA en flujo (no absolute, §3.15), pegados abajo */}
      <div className="mt-auto pt-5">
        {error && (
          <p role="alert" className="mb-2 text-center text-[12px] font-medium text-rojo">
            {error}
          </p>
        )}
        <TecladoNumerico onDigito={tocarDigito} onComa={tocarComa} onBorrar={tocarBorrar} />
        <BotonPrimario
          className="mt-3 mb-[max(26px,env(safe-area-inset-bottom))]"
          disabled={centavos <= 0 || !medio || pendiente}
          onClick={guardar}
        >
          {pendiente ? "Guardando…" : categoriaId ? "Listo" : "Guardar sin categoría"}
        </BotonPrimario>
      </div>
    </div>
  );
}

// Variante compacta del segmented Hogar/Personal (header de 03, §3.18):
// track radius 9, segmentos 5px 12px radius 7, 11.5px.
function SegmentedMini({
  valor,
  onCambio,
}: {
  valor: Ambito;
  onCambio: (a: Ambito) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Ámbito del gasto"
      className="flex rounded-chip-chico bg-fondo-segmented p-[2px]"
    >
      {(["hogar", "personal"] as const).map((a) => (
        <button
          key={a}
          type="button"
          aria-pressed={valor === a}
          onClick={() => onCambio(a)}
          className={`hit-44 rounded-[7px] px-3 py-[5px] text-[11.5px] transition-colors ${
            valor === a
              ? "bg-segmented-activo font-semibold text-tinta shadow-thumb"
              : "font-medium text-tinta-secundaria"
          }`}
        >
          {a === "hogar" ? "Hogar" : "Personal"}
        </button>
      ))}
    </div>
  );
}
