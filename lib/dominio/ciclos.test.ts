import { describe, expect, it } from "vitest";
import { asignarCiclo, proponerCicloSiguiente } from "./ciclos";

const ciclos = [
  { id: "jun", fechaCierre: "2026-06-28" },
  { id: "jul", fechaCierre: "2026-07-28" },
  { id: "ago", fechaCierre: "2026-08-28" },
];

describe("asignarCiclo", () => {
  it("un consumo cae en el ciclo abierto más cercano por fecha <= cierre", () => {
    expect(asignarCiclo("2026-07-10", ciclos)).toBe("jul");
    expect(asignarCiclo("2026-06-29", ciclos)).toBe("jul");
    expect(asignarCiclo("2026-08-01", ciclos)).toBe("ago");
  });

  it("caso borde: un consumo EN la fecha exacta de cierre pertenece a ese ciclo", () => {
    expect(asignarCiclo("2026-07-28", ciclos)).toBe("jul");
    expect(asignarCiclo("2026-07-29", ciclos)).toBe("ago");
  });

  it("sin ciclo que lo cubra devuelve null (se asigna cuando exista)", () => {
    expect(asignarCiclo("2026-09-15", ciclos)).toBeNull();
  });

  it("reasignación al corregir fecha: el mismo consumo cambia de ciclo", () => {
    // El cierre estimado del 28 jul se corrige al 26 jul: lo comprado el 27
    // deja de pertenecer al ciclo julio y pasa al siguiente.
    const corregidos = [
      { id: "jul", fechaCierre: "2026-07-26" },
      { id: "ago", fechaCierre: "2026-08-28" },
    ];
    expect(asignarCiclo("2026-07-27", ciclos)).toBe("jul");
    expect(asignarCiclo("2026-07-27", corregidos)).toBe("ago");
  });
});

describe("proponerCicloSiguiente", () => {
  it("propone mismo día del mes siguiente", () => {
    // 28 ago 2026 cae viernes: queda igual
    expect(proponerCicloSiguiente("2026-07-28").fechaCierre).toBe("2026-08-28");
  });

  it("corre a día hábil hacia atrás si cae en fin de semana", () => {
    // 28 nov 2026 es sábado → viernes 27
    expect(proponerCicloSiguiente("2026-10-28").fechaCierre).toBe("2026-11-27");
  });

  it("el vencimiento propuesto queda después del cierre", () => {
    const p = proponerCicloSiguiente("2026-07-28");
    expect(p.fechaVencimiento > p.fechaCierre).toBe(true);
  });
});
