import { describe, expect, it } from "vitest";
import {
  claveNombre,
  ICONOS_DISPONIBLES,
  ICONOS_POR_TEMA,
  validarNombre,
} from "./categorias";

describe("claveNombre — para que no se dupliquen categorías", () => {
  it("ignora mayúsculas, tildes y espacios de más", () => {
    expect(claveNombre("  Café   Cuervo ")).toBe("cafe cuervo");
    expect(claveNombre("CAFE CUERVO")).toBe("cafe cuervo");
    expect(claveNombre("Ñoquis")).toBe("noquis");
  });
});

describe("validarNombre", () => {
  const existentes = ["Supermercado", "Café Cuervo"];

  it("acepta un nombre nuevo", () => {
    expect(validarNombre("Peluquería", existentes)).toBeNull();
  });

  it("rechaza vacío y solo espacios", () => {
    expect(validarNombre("", existentes)).toBe("vacio");
    expect(validarNombre("   ", existentes)).toBe("vacio");
  });

  it("rechaza más de 40 caracteres", () => {
    expect(validarNombre("x".repeat(41), existentes)).toBe("largo");
    expect(validarNombre("x".repeat(40), existentes)).toBeNull();
  });

  it("rechaza el repetido aunque cambie tildes o mayúsculas", () => {
    expect(validarNombre("supermercado", existentes)).toBe("repetido");
    expect(validarNombre("cafe cuervo", existentes)).toBe("repetido");
    expect(validarNombre("  Supermercado  ", existentes)).toBe("repetido");
  });
});

describe("catálogo de íconos", () => {
  it("no tiene repetidos: cada ícono aparece en un solo tema", () => {
    expect(new Set(ICONOS_DISPONIBLES).size).toBe(ICONOS_DISPONIBLES.length);
  });

  it("incluye el fallback tag, que es el ícono por defecto de la tabla", () => {
    expect(ICONOS_DISPONIBLES).toContain("tag");
  });

  it("todos los temas tienen al menos un ícono", () => {
    for (const g of ICONOS_POR_TEMA) expect(g.iconos.length).toBeGreaterThan(0);
  });
});
