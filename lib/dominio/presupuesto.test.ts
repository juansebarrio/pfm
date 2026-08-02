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

describe("estadoPartida — las compuertas de la proyección (2026-08-02)", () => {
  it("antes del día 7 no hay proyección: una compra grande el día 2 no alarma", () => {
    // el bug que motivó esto: $ 40.000 de súper el día 2 "proyectaba" $ 620.000
    const r = estadoPartida({
      asignadoCentavos: 52000000, gastadoCentavos: 4000000,
      diaDelMes: 2, diasDelMes: 31,
    });
    expect(r.estado).toBe("ok");
    expect(r.proyeccionCentavos).toBeNull();
    expect(r.excedenteProyectadoCentavos).toBeNull();
  });

  it("el día 6 todavía calla; el día 7 ya proyecta", () => {
    const base = { asignadoCentavos: 20000000, gastadoCentavos: 7000000, diasDelMes: 31 };
    const dia6 = estadoPartida({ ...base, diaDelMes: 6 });
    expect(dia6.estado).toBe("ok");
    expect(dia6.proyeccionCentavos).toBeNull();

    const dia7 = estadoPartida({ ...base, diaDelMes: 7 });
    expect(dia7.estado).toBe("atencion"); // proyecta 31.000.000 > 22.000.000
    expect(dia7.proyeccionCentavos).toBe(31000000);
  });

  it("pasarse hasta un 10 % no alarma: la proyección se muestra pero en calma", () => {
    // proyección $ 325.500 sobre $ 310.000 disponibles (5 % arriba) → ok
    const r = estadoPartida({
      asignadoCentavos: 31000000, gastadoCentavos: 10500000,
      diaDelMes: 10, diasDelMes: 31,
    });
    expect(r.estado).toBe("ok");
    expect(r.proyeccionCentavos).toBe(32550000);
    expect(r.excedenteProyectadoCentavos).toBeNull();
  });

  it("pasarse más del 10 % sí alarma", () => {
    // proyección $ 372.000 sobre $ 310.000 (20 % arriba) → atención
    const r = estadoPartida({
      asignadoCentavos: 31000000, gastadoCentavos: 12000000,
      diaDelMes: 10, diasDelMes: 31,
    });
    expect(r.estado).toBe("atencion");
    expect(r.excedenteProyectadoCentavos).toBe(6200000);
  });

  it("excedido no pasa por compuertas: el día 2 pasado es excedido igual", () => {
    const r = estadoPartida({
      asignadoCentavos: 4000000, gastadoCentavos: 4500000,
      diaDelMes: 2, diasDelMes: 31,
    });
    expect(r.estado).toBe("excedido");
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
