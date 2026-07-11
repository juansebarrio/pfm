import { describe, expect, it } from "vitest";
import {
  asignarCiclo,
  generarCiclosHasta,
  primerCicloEstimado,
  proponerCicloSiguiente,
} from "./ciclos";

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

describe("primerCicloEstimado — tarjeta nueva sin ciclos", () => {
  it("el primer cierre es el día indicado del mes corriente si todavía no pasó", () => {
    expect(primerCicloEstimado(28, "2026-07-10").fechaCierre).toBe("2026-07-28");
  });

  it("si el día ya pasó este mes, arranca el mes siguiente", () => {
    expect(primerCicloEstimado(5, "2026-07-10").fechaCierre).toBe("2026-08-05");
  });

  it("corre a día hábil y el vencimiento queda después", () => {
    const p = primerCicloEstimado(28, "2026-10-01"); // 28 nov es sábado
    expect(p.fechaCierre).toBe("2026-10-28");
    expect(p.fechaVencimiento > p.fechaCierre).toBe(true);
  });
});

describe("generarCiclosHasta — cubrir cuotas futuras", () => {
  it("genera los ciclos que faltan para cubrir una fecha lejana", () => {
    // último cierre conocido 28 jul; una cuota devenga el 1 feb 2027
    const nuevos = generarCiclosHasta("2026-07-28", "2027-02-01");
    expect(nuevos.length).toBeGreaterThanOrEqual(6);
    expect(nuevos.at(-1)!.fechaCierre >= "2027-02-01").toBe(true);
    // cada cierre es posterior al anterior
    for (let i = 1; i < nuevos.length; i++) {
      expect(nuevos[i].fechaCierre > nuevos[i - 1].fechaCierre).toBe(true);
    }
  });

  it("no genera nada si el último cierre ya cubre la fecha", () => {
    expect(generarCiclosHasta("2026-08-28", "2026-08-01")).toEqual([]);
  });

  it("el primer ciclo generado cubre un consumo justo después del último cierre", () => {
    const nuevos = generarCiclosHasta("2026-07-28", "2026-08-01");
    expect(nuevos.length).toBe(1);
    expect(asignarCiclo("2026-08-01", [
      { id: "nuevo", fechaCierre: nuevos[0].fechaCierre },
    ])).toBe("nuevo");
  });
});
