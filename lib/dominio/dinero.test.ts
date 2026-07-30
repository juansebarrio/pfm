import { describe, expect, it } from "vitest";
import {
  arsAUsd,
  centavosDesdeTexto,
  formatearImporte,
  formatearPorcentaje,
  usdAArs,
} from "./dinero";

describe("formatearImporte", () => {
  it("formatea ARS con miles con punto y sin decimales cuando no hay centavos", () => {
    expect(formatearImporte(52000000)).toBe("$ 520.000");
    expect(formatearImporte(123456700)).toBe("$ 1.234.567");
    expect(formatearImporte(8432000)).toBe("$ 84.320");
  });

  it("muestra centavos con coma solo cuando existen", () => {
    expect(formatearImporte(123456)).toBe("$ 1.234,56");
    expect(formatearImporte(100005)).toBe("$ 1.000,05");
  });

  it("formatea USD con prefijo sin símbolo", () => {
    expect(formatearImporte(600000, "USD")).toBe("USD 6.000");
    expect(formatearImporte(3220000, "USD")).toBe("USD 32.200");
  });

  it("cero y negativos", () => {
    expect(formatearImporte(0)).toBe("$ 0");
    expect(formatearImporte(-1050000)).toBe("− $ 10.500");
  });

  it("rechaza floats: ningún float toca plata", () => {
    expect(() => formatearImporte(100.5)).toThrow();
  });
});

describe("centavosDesdeTexto", () => {
  it("lee de vuelta lo que emite formatearImporte", () => {
    expect(centavosDesdeTexto("$ 564.900")).toBe(56490000);
    expect(centavosDesdeTexto("$ 1.234.567,89")).toBe(123456789);
    expect(centavosDesdeTexto("$ 6.800")).toBe(680000);
  });

  it("ida y vuelta sobre importes reales", () => {
    for (const centavos of [1, 99, 100, 680000, 8432000, 123456789]) {
      expect(centavosDesdeTexto(formatearImporte(centavos))).toBe(centavos);
    }
  });

  it("descarta el signo: la dirección la lleva el tipo del movimiento", () => {
    expect(centavosDesdeTexto("− $ 12.500")).toBe(1250000);
    expect(centavosDesdeTexto("-$ 12.500")).toBe(1250000);
  });

  it("devuelve null con basura, en vez de inventar un número", () => {
    expect(centavosDesdeTexto("bastante")).toBeNull();
    expect(centavosDesdeTexto("")).toBeNull();
    expect(centavosDesdeTexto("$ mil pesos")).toBeNull();
  });

  it("rechaza el formato con otra convención de miles y decimales", () => {
    // "$ 1,234.56" es inglés: leerlo como argentino daría $ 1,23
    expect(centavosDesdeTexto("$ 1,234.56")).toBeNull();
  });
});

describe("formatearPorcentaje", () => {
  it("porcentaje con espacio como el export", () => {
    expect(formatearPorcentaje(81.1)).toBe("81 %");
  });
});

describe("conversiones con TC", () => {
  const TC_MEP = 147000; // $ 1.470 en centavos

  it("USD 9.500 al MEP $ 1.470 = $ 13.965.000 (verificación del export)", () => {
    expect(usdAArs(950000, TC_MEP)).toBe(1396500000);
  });

  it("USD 7.800 = $ 11.466.000 / USD 6.000 = $ 8.820.000 / USD 2.100 = $ 3.087.000", () => {
    expect(usdAArs(780000, TC_MEP)).toBe(1146600000);
    expect(usdAArs(600000, TC_MEP)).toBe(882000000);
    expect(usdAArs(210000, TC_MEP)).toBe(308700000);
  });

  it("el patrimonio del export cierra: $ 47.388.000 ≈ USD 32.236,73", () => {
    expect(arsAUsd(4738800000, TC_MEP)).toBe(3223673);
  });

  it("rechaza floats", () => {
    expect(() => usdAArs(100.5, TC_MEP)).toThrow();
    expect(() => arsAUsd(100, 1470.5)).toThrow();
  });
});
