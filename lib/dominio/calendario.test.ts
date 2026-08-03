import { describe, expect, it } from "vitest";
import { plataPorDia, recurrentesPorDia, semanasDelMes } from "./calendario";

describe("semanasDelMes", () => {
  it("agosto 2026 arranca sábado: 5 rellenos y 6 semanas", () => {
    const semanas = semanasDelMes("2026-08-01");
    expect(semanas).toHaveLength(6);
    expect(semanas[0]).toEqual([null, null, null, null, null, "2026-08-01", "2026-08-02"]);
    // el 31 cae lunes: última fila con 6 rellenos al final
    expect(semanas[5]).toEqual(["2026-08-31", null, null, null, null, null, null]);
  });

  it("febrero 2027 arranca lunes y mide 28: 4 semanas justas, sin relleno", () => {
    const semanas = semanasDelMes("2027-02-01");
    expect(semanas).toHaveLength(4);
    expect(semanas.flat().every((c) => c !== null)).toBe(true);
    expect(semanas[0][0]).toBe("2027-02-01");
    expect(semanas[3][6]).toBe("2027-02-28");
  });

  it("toda fila mide 7 y los días del mes están todos, en orden", () => {
    const semanas = semanasDelMes("2026-07-01");
    expect(semanas.every((s) => s.length === 7)).toBe(true);
    const fechas = semanas.flat().filter((c): c is string => c !== null);
    expect(fechas).toHaveLength(31);
    expect(fechas[0]).toBe("2026-07-01");
    expect(fechas[30]).toBe("2026-07-31");
  });
});

describe("plataPorDia", () => {
  it("suma gastos e ingresos por fecha, separados", () => {
    const porDia = plataPorDia([
      { fecha: "2026-08-10", tipo: "gasto", importeCentavos: 100 },
      { fecha: "2026-08-10", tipo: "gasto", importeCentavos: 50 },
      { fecha: "2026-08-10", tipo: "ingreso", importeCentavos: 999 },
      { fecha: "2026-08-11", tipo: "ingreso", importeCentavos: 1 },
    ]);
    expect(porDia.get("2026-08-10")).toEqual({ gastosCentavos: 150, ingresosCentavos: 999 });
    expect(porDia.get("2026-08-11")).toEqual({ gastosCentavos: 0, ingresosCentavos: 1 });
    expect(porDia.has("2026-08-12")).toBe(false);
  });
});

describe("recurrentesPorDia", () => {
  it("resuelve diaMes a la fecha del mes pedido y agrupa", () => {
    const porDia = recurrentesPorDia("2026-08-01", [
      { diaMes: 5, nombre: "Luz" },
      { diaMes: 5, nombre: "Gas" },
      { diaMes: 18, nombre: "Prepaga" },
    ]);
    expect(porDia.get("2026-08-05")?.map((r) => r.nombre)).toEqual(["Luz", "Gas"]);
    expect(porDia.get("2026-08-18")).toHaveLength(1);
  });
});
