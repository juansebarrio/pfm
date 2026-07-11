import { describe, expect, it } from "vitest";
import {
  comprometidoPorMes,
  computaEnPresupuesto,
  diferenciaConciliacion,
  mesLibre,
  proyectadoResumen,
} from "./tarjetas";

describe("computaEnPresupuesto — el pago del resumen jamás es gasto", () => {
  it("pago_resumen NUNCA computa, ni con categoría", () => {
    expect(computaEnPresupuesto("pago_resumen", null)).toBe(false);
    expect(computaEnPresupuesto("pago_resumen", "una-categoria")).toBe(false);
  });

  it("transferencia tampoco computa", () => {
    expect(computaEnPresupuesto("transferencia", "una-categoria")).toBe(false);
  });

  it("gasto con categoría computa; sin categoría va a la bandeja y no computa", () => {
    expect(computaEnPresupuesto("gasto", "una-categoria")).toBe(true);
    expect(computaEnPresupuesto("gasto", null)).toBe(false);
  });

  it("ingreso no computa como gasto", () => {
    expect(computaEnPresupuesto("ingreso", "una-categoria")).toBe(false);
  });
});

describe("proyectadoResumen — el desglose del export cierra", () => {
  it("Visa: 486.200 + 296.250 + 58.000 = 840.450", () => {
    expect(
      proyectadoResumen({
        consumosCentavos: 48620000,
        cuotasCentavos: 29625000,
        impuestosCentavos: 5800000,
      }),
    ).toBe(84045000);
  });

  it("Mastercard: 121.200 + impuestos 31.500 = 152.700", () => {
    expect(
      proyectadoResumen({
        consumosCentavos: 7790000,
        cuotasCentavos: 4330000,
        impuestosCentavos: 3150000,
      }),
    ).toBe(15270000);
  });

  it("rechaza floats", () => {
    expect(() =>
      proyectadoResumen({ consumosCentavos: 1.5, cuotasCentavos: 0, impuestosCentavos: 0 }),
    ).toThrow();
  });
});

describe("diferenciaConciliacion", () => {
  it("diferencia chica (≤5 %) en verde", () => {
    // proyectado jun 728.550 vs real 734.500 → +5.950 (0,8 %)
    const d = diferenciaConciliacion(73450000, 72855000);
    expect(d.centavos).toBe(595000);
    expect(d.tono).toBe("verde");
  });

  it("diferencia grande en ámbar, para los dos lados", () => {
    expect(diferenciaConciliacion(90000000, 72855000).tono).toBe("ambar");
    expect(diferenciaConciliacion(60000000, 72855000).tono).toBe("ambar");
  });

  it("clavado al proyectado: diferencia 0 en verde", () => {
    const d = diferenciaConciliacion(84045000, 84045000);
    expect(d.centavos).toBe(0);
    expect(d.tono).toBe("verde");
  });
});

describe("comprometidoPorMes + mesLibre — la historia del export", () => {
  // Aire 5/12 (mar 26 → feb 27, 86.250), Notebook 5/6 (mar → ago, 210.000),
  // Zapatillas 2/3 (jun → ago, 43.300)
  const cuotas = [
    ...Array.from({ length: 12 }, (_, i) => {
      const total = 2026 * 12 + 2 + i; // mar 2026 = índice 2
      return {
        fecha: `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`,
        importeCentavos: 8625000,
      };
    }),
    ...Array.from({ length: 6 }, (_, i) => {
      const total = 2026 * 12 + 2 + i;
      return {
        fecha: `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`,
        importeCentavos: 21000000,
      };
    }),
    ...Array.from({ length: 3 }, (_, i) => {
      const total = 2026 * 12 + 5 + i; // jun 2026
      return {
        fecha: `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`,
        importeCentavos: 4330000,
      };
    }),
  ];

  it("agosto compromete $ 339.550 y desde septiembre $ 86.250", () => {
    const meses = comprometidoPorMes(cuotas, "2026-08-01", 12);
    expect(meses[0]).toEqual({ mes: "2026-08-01", centavos: 33955000 });
    expect(meses[1].centavos).toBe(8625000);
    expect(meses[6].centavos).toBe(8625000); // feb 2027, última del Aire
  });

  it("en marzo (2027) quedás libre", () => {
    const meses = comprometidoPorMes(cuotas, "2026-08-01", 12);
    expect(mesLibre(meses)).toBe("2027-03-01");
  });

  it("sin cuotas no hay liberación que anunciar", () => {
    expect(mesLibre(comprometidoPorMes([], "2026-08-01", 12))).toBeNull();
  });
});
