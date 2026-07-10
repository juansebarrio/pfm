"use client";

import { useState } from "react";
import { formatearImporte } from "@/lib/dominio/dinero";
import { BotonPrimario } from "@/components/sistema/BotonPrimario";
import { Card } from "@/components/sistema/Card";
import { HojaInferior } from "@/components/sistema/HojaInferior";
import { Importe } from "@/components/sistema/Importe";
import { TecladoNumerico } from "@/components/sistema/TecladoNumerico";

export function DemoTeclado() {
  const [digitos, setDigitos] = useState("84320");

  return (
    <Card className="p-4">
      <div className="mb-4 text-center">
        <Importe centavos={Number(digitos || "0") * 100} variante="hero-alta" />
      </div>
      <TecladoNumerico
        onDigito={(d) => setDigitos((v) => (v + d).slice(0, 9))}
        onComa={() => {}}
        onBorrar={() => setDigitos((v) => v.slice(0, -1))}
      />
    </Card>
  );
}

export function DemoHoja() {
  const [abierta, setAbierta] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className="w-full rounded-cta border border-borde bg-superficie py-3 text-[14px] font-medium text-verde"
      >
        Abrir hoja inferior
      </button>
      <HojaInferior abierta={abierta} onCerrar={() => setAbierta(false)} titulo="Conciliar resumen">
        <p className="text-[13.5px] leading-[1.55] text-tinta-secundaria">
          Cuando llegue el real, cargá el total y vemos la diferencia. Proyectado:{" "}
          {formatearImporte(84045000)}.
        </p>
        <BotonPrimario className="mt-4" onClick={() => setAbierta(false)}>
          Listo
        </BotonPrimario>
      </HojaInferior>
    </>
  );
}
