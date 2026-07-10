import { describe, expect, it } from "vitest";
import { estadoPartida, proyeccionLineal } from "./presupuesto";

const dia = { diaDelMes: 10, diasDelMes: 31 }; // viernes 10 de julio de 2026

describe("estadoPartida — los cuatro casos del brief", () => {
  it("fija pagada al 100 % se ve calma (ok)", () => {
    const r = estadoPartida({
      asignadoCentavos: 78000000, gastadoCentavos: 78000000, fija: true, ...dia,
    });
    expect(r.estado).toBe("ok");
    expect(r.quedaCentavos).toBe(0);
  });

  it("proyección dentro del asignado → ok", () => {
    // Farmacia: $ 12.500 de $ 40.000 al día 10 → proyecta $ 38.750
    const r = estadoPartida({ asignadoCentavos: 4000000, gastadoCentavos: 1250000, ...dia });
    expect(r.estado).toBe("ok");
    expect(r.proyeccionCentavos).toBe(3875000);
  });

  it("proyección pasada → atención", () => {
    // Supermercado: $ 268.400 de $ 520.000 al día 10 → proyecta $ 832.040
    const r = estadoPartida({ asignadoCentavos: 52000000, gastadoCentavos: 26840000, ...dia });
    expect(r.estado).toBe("atencion");
    expect(r.proyeccionCentavos).toBe(83204000);
    expect(r.excedenteProyectadoCentavos).toBe(31204000);
  });

  it("gastado ya por encima → excedido", () => {
    const r = estadoPartida({ asignadoCentavos: 9000000, gastadoCentavos: 9500000, ...dia });
    expect(r.estado).toBe("excedido");
    expect(r.quedaCentavos).toBe(-500000);
  });
});

describe("estadoPartida — reglas anotadas", () => {
  it("el rollover suma al disponible de la partida", () => {
    // Suscripciones: $ 41.200 de $ 55.000 + $ 13.800 de junio → queda $ 27.600
    const r = estadoPartida({
      asignadoCentavos: 5500000, gastadoCentavos: 4120000,
      rolloverCentavos: 1380000, rollover: true, ...dia,
    });
    expect(r.quedaCentavos).toBe(2760000);
    expect(r.estado).toBe("ok"); // pool de arrastre: no proyecta
    expect(r.proyeccionCentavos).toBeNull();
  });

  it("sin gasto no hay proyección (Luz, $ 0 de $ 45.000)", () => {
    const r = estadoPartida({ asignadoCentavos: 4500000, gastadoCentavos: 0, ...dia });
    expect(r.estado).toBe("ok");
    expect(r.proyeccionCentavos).toBeNull();
  });

  it("una fija a medio pagar tampoco alarma", () => {
    const r = estadoPartida({
      asignadoCentavos: 78000000, gastadoCentavos: 0, fija: true, ...dia,
    });
    expect(r.estado).toBe("ok");
  });

  it("excedido le gana a fija: si se pasó, se pasó", () => {
    const r = estadoPartida({
      asignadoCentavos: 4500000, gastadoCentavos: 5100000, fija: true, ...dia,
    });
    expect(r.estado).toBe("excedido");
  });

  it("gastar exactamente el disponible no es excederse", () => {
    const r = estadoPartida({ asignadoCentavos: 1000000, gastadoCentavos: 1000000, ...dia });
    expect(r.estado).toBe("atencion"); // proyecta 3.100.000 > 1.000.000
    expect(r.quedaCentavos).toBe(0);
  });
});

describe("proyeccionLineal", () => {
  it("gastado / días transcurridos × días del mes", () => {
    expect(proyeccionLineal(26840000, 10, 31)).toBe(83204000);
    expect(proyeccionLineal(7130000, 10, 31)).toBe(22103000);
  });

  it("primer día del mes proyecta ×días", () => {
    expect(proyeccionLineal(100, 1, 31)).toBe(3100);
  });

  it("último día del mes proyecta el gastado tal cual", () => {
    expect(proyeccionLineal(4444400, 31, 31)).toBe(4444400);
  });

  it("valida el día", () => {
    expect(() => proyeccionLineal(100, 0, 31)).toThrow();
    expect(() => proyeccionLineal(100, 32, 31)).toThrow();
    expect(() => proyeccionLineal(100.5, 10, 31)).toThrow();
  });
});
