import { describe, expect, it } from "vitest";
import {
  DECIMAS_MAXIMAS,
  DECIMAS_POR_DEFECTO,
  ajustarPorInflacion,
  decimasATexto,
  esTextoDecimasValido,
  moverDecimas,
  textoADecimas,
} from "./inflacion";

describe("ajustarPorInflacion", () => {
  it("aplica el ajuste por defecto (2,5 %) sobre un monto redondo", () => {
    // $ 100.000 + 2,5 % = $ 102.500
    expect(ajustarPorInflacion(10_000_000, DECIMAS_POR_DEFECTO)).toBe(10_250_000);
    // $ 87.000 + 2,5 % = $ 89.175 (ya es múltiplo de 25: no hay redondeo)
    expect(ajustarPorInflacion(8_700_000, 25)).toBe(8_917_500);
  });

  it("trabaja con décimas de punto, no con puntos enteros", () => {
    // 0,1 % sobre $ 1.000.000 = $ 1.001.000
    expect(ajustarPorInflacion(100_000_000, 1)).toBe(100_100_000);
    // 12,3 % sobre $ 200.000 = $ 224.600
    expect(ajustarPorInflacion(20_000_000, 123)).toBe(22_460_000);
    // una décima más mueve el número: la resolución es real, no decorativa
    expect(ajustarPorInflacion(20_000_000, 124)).not.toBe(
      ajustarPorInflacion(20_000_000, 123),
    );
  });

  it("apoya el resultado en múltiplos de $ 25", () => {
    // $ 33.333 + 2,5 % = $ 34.166,32… → $ 34.175
    expect(ajustarPorInflacion(3_333_300, 25)).toBe(3_417_500);
    for (const decimas of [0, 1, 25, 37, 180, 999]) {
      expect(ajustarPorInflacion(3_333_300, decimas) % 2500).toBe(0);
    }
  });

  it("con 0 % redondea igual: 'copiar sin ajuste' deja montos redondos", () => {
    // el borde a tener presente: 0 % NO es una copia textual
    expect(ajustarPorInflacion(38_372_700, 0)).toBe(38_372_500);
    // un monto que ya es múltiplo de $ 25 sí queda idéntico
    expect(ajustarPorInflacion(10_000_000, 0)).toBe(10_000_000);
    expect(ajustarPorInflacion(8_917_500, 0)).toBe(8_917_500);
  });

  it("montos chicos: por debajo de $ 12,50 el ajuste los apaga", () => {
    // $ 10 + 2,5 % = $ 10,25 → más cerca de $ 0 que de $ 25
    expect(ajustarPorInflacion(1_000, 25)).toBe(0);
    // $ 13 ya redondea para arriba
    expect(ajustarPorInflacion(1_300, 0)).toBe(2_500);
    expect(ajustarPorInflacion(1_200, 0)).toBe(0);
    // una partida en cero se queda en cero, se ajuste lo que se ajuste
    expect(ajustarPorInflacion(0, 25)).toBe(0);
    expect(ajustarPorInflacion(0, 9_999)).toBe(0);
  });

  it("no acumula float: recalcular mil veces da el mismo número", () => {
    const uno = ajustarPorInflacion(12_345_600, 37);
    for (let i = 0; i < 1000; i++) {
      expect(ajustarPorInflacion(12_345_600, 37)).toBe(uno);
    }
    expect(Number.isInteger(uno)).toBe(true);
  });

  it("rechaza entradas que no son enteras", () => {
    expect(() => ajustarPorInflacion(1000.5, 25)).toThrow();
    expect(() => ajustarPorInflacion(1000, 2.5)).toThrow();
  });
});

describe("décimas ↔ texto", () => {
  it("formatea con una sola décima y sin coma cuando es redondo", () => {
    expect(decimasATexto(25)).toBe("2,5");
    expect(decimasATexto(120)).toBe("12");
    expect(decimasATexto(0)).toBe("0");
    expect(decimasATexto(1)).toBe("0,1");
    expect(decimasATexto(9999)).toBe("999,9");
  });

  it("parsea lo que se tipea, incluida la coma a medio escribir", () => {
    expect(textoADecimas("2,5")).toBe(25);
    expect(textoADecimas("2,")).toBe(20);
    expect(textoADecimas("2")).toBe(20);
    expect(textoADecimas("")).toBe(0);
    expect(textoADecimas("0")).toBe(0);
    expect(textoADecimas("abc")).toBe(0);
  });

  it("ida y vuelta sin pérdida", () => {
    for (const decimas of [0, 1, 25, 100, 123, 9999]) {
      expect(textoADecimas(decimasATexto(decimas))).toBe(decimas);
    }
  });

  it("valida tecla a tecla, no solo el resultado final", () => {
    for (const texto of ["", "2", "2,", "2,5", "999,9", "0"]) {
      expect(esTextoDecimasValido(texto)).toBe(true);
    }
    for (const texto of ["1000", "2,55", "-3", "2.5", "2,5,", "a"]) {
      expect(esTextoDecimasValido(texto)).toBe(false);
    }
  });
});

describe("moverDecimas", () => {
  it("sube y baja de a una décima", () => {
    expect(moverDecimas(25, 1)).toBe(26);
    expect(moverDecimas(25, -1)).toBe(24);
  });

  it("no baja de 0 ni pasa el techo", () => {
    expect(moverDecimas(0, -1)).toBe(0);
    expect(moverDecimas(DECIMAS_MAXIMAS, 1)).toBe(DECIMAS_MAXIMAS);
  });
});
