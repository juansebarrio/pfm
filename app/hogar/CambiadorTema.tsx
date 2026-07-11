"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, SunMoon } from "lucide-react";
import { Card } from "@/components/sistema/Card";
import { Chip } from "@/components/sistema/Chip";

// Modo oscuro (tanda 8): respeta prefers-color-scheme por defecto ("auto") y
// el toggle manual persiste en localStorage("tema"). El script del layout raíz
// aplica data-tema antes del primer paint para evitar flash.

type Tema = "auto" | "claro" | "oscuro";

const OPCIONES: Array<{ valor: Tema; etiqueta: string; Icono: typeof Sun }> = [
  { valor: "auto", etiqueta: "Auto", Icono: SunMoon },
  { valor: "claro", etiqueta: "Claro", Icono: Sun },
  { valor: "oscuro", etiqueta: "Oscuro", Icono: Moon },
];

export function CambiadorTema() {
  const [tema, setTema] = useState<Tema>("auto");

  useEffect(() => {
    const guardado = window.localStorage.getItem("tema");
    if (guardado === "claro" || guardado === "oscuro") setTema(guardado);
  }, []);

  function elegir(nuevo: Tema) {
    setTema(nuevo);
    if (nuevo === "auto") {
      window.localStorage.removeItem("tema");
      delete document.documentElement.dataset.tema;
    } else {
      window.localStorage.setItem("tema", nuevo);
      document.documentElement.dataset.tema = nuevo;
    }
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
