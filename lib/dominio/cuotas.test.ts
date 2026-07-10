import { describe, expect, it } from "vitest";
import { generarCuotas, mesUltimaCuota } from "./cuotas";

describe("generarCuotas", () => {
  it("la suma de las cuotas cierra exacta aunque la división no sea entera", () => {
    const cuotas = generarCuotas(100000, 3, "2026-07-10"); // $ 1.000 en 3
    expect(cuotas.map((c) => c.importeCentavos)).toEqual([33334, 33333, 33333]);
    expect(cuotas.reduce((s, c) => s + c.importeCentavos, 0)).toBe(100000);
  });

  it("el resto va entero a la primera cuota", () => {
    const cuotas = generarCuotas(1000001, 12, "2026-01-15");
    const base = Math.floor(1000001 / 12); // 83333
    expect(cuotas[0].importeCentavos).toBe(base + (1000001 - base * 12));
    expect(cuotas.slice(1).every((c) => c.importeCentavos === base)).toBe(true);
    expect(cuotas.reduce((s, c) => s + c.importeCentavos, 0)).toBe(1000001);
  });

  it("las cuotas devengan el día 1 de meses consecutivos desde el mes de compra", () => {
    const cuotas = generarCuotas(103500000, 12, "2026-03-01"); // Aire acondicionado
    expect(cuotas[0].fecha).toBe("2026-03-01");
    expect(cuotas[4].fecha).toBe("2026-07-01"); // cuota 5/12 devenga en julio
    expect(cuotas[11].fecha).toBe("2027-02-01"); // termina feb 2027
    expect(cuotas.every((c) => c.importeCentavos === 8625000)).toBe(true); // $ 86.250
  });

  it("cruza el fin de año sin drama", () => {
    const cuotas = generarCuotas(60000, 6, "2026-10-05");
    expect(cuotas.map((c) => c.fecha)).toEqual([
      "2026-10-01",
      "2026-11-01",
      "2026-12-01",
      "2027-01-01",
      "2027-02-01",
      "2027-03-01",
    ]);
  });

  it("las tres compras del seed dan los montos del export", () => {
    // Aire: $ 1.035.000 en 12 → $ 86.250/mes
    expect(generarCuotas(103500000, 12, "2026-03-01")[0].importeCentavos).toBe(8625000);
    // Notebook: $ 1.260.000 en 6 → $ 210.000/mes, termina ago 2026
    expect(generarCuotas(126000000, 6, "2026-03-01")[5].fecha).toBe("2026-08-01");
    expect(generarCuotas(126000000, 6, "2026-03-01")[0].importeCentavos).toBe(21000000);
    // Zapatillas: $ 129.900 en 3 → $ 43.300/mes, termina ago 2026
    expect(generarCuotas(12990000, 3, "2026-06-01")[0].importeCentavos).toBe(4330000);
    expect(mesUltimaCuota("2026-06-01", 3)).toBe("2026-08");
  });

  it("rechaza totales o cuotas inválidos", () => {
    expect(() => generarCuotas(0, 3, "2026-01-01")).toThrow();
    expect(() => generarCuotas(100.5, 3, "2026-01-01")).toThrow();
    expect(() => generarCuotas(1000, 0, "2026-01-01")).toThrow();
    expect(() => generarCuotas(1000, 61, "2026-01-01")).toThrow();
  });
});
