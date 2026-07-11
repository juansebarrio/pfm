"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Card } from "@/components/sistema/Card";
import { Chip } from "@/components/sistema/Chip";

// Tema de la app. El DEFAULT es oscuro (:root en globals.css); el toggle deja
// pasar a claro y persiste la elección en localStorage("tema"). El script del
// layout raíz aplica data-tema antes del primer paint para evitar flash.

type Tema = "claro" | "oscuro";

const OPCIONES: Array<{ valor: Tema; etiqueta: string; Icono: typeof Sun }> = [
  { valor: "oscuro", etiqueta: "Oscuro", Icono: Moon },
  { valor: "claro", etiqueta: "Claro", Icono: Sun },
];

export function CambiadorTema() {
  // sin elección guardada, el default es oscuro
  const [tema, setTema] = useState<Tema>("oscuro");

  useEffect(() => {
    const guardado = window.localStorage.getItem("tema");
    setTema(guardado === "claro" ? "claro" : "oscuro");
  }, []);

  function elegir(nuevo: Tema) {
    setTema(nuevo);
    window.localStorage.setItem("tema", nuevo);
    document.documentElement.dataset.tema = nuevo;
  }

  return (
    <Card className="mt-4 flex items-center justify-between px-4 py-3.5">
      <span className="text-[14px] font-medium text-tinta">Tema</span>
      <div role="group" aria-label="Tema de la app" className="flex gap-1.5">
        {OPCIONES.map(({ valor, etiqueta, Icono }) => (
          <Chip
            key={valor}
            escala="mini"
            seleccionado={tema === valor}
            onClick={() => elegir(valor)}
          >
            <Icono className="size-3" strokeWidth={1.5} aria-hidden />
            {etiqueta}
          </Chip>
        ))}
      </div>
    </Card>
  );
}
