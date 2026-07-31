import { describe, expect, it } from "vitest";
import { CLAVE_OTRAS, arcos, repartir, type ItemReparto } from "./reparto";

const item = (nombre: string, centavos: number): ItemReparto => ({
  clave: nombre.toLowerCase(),
  nombre,
  icono: "tag",
  centavos,
});

/** Lo que la pantalla no puede permitirse: que los porcentajes no sumen 100. */
const suma = (ps: Array<{ porcentaje: number }>) =>
  ps.reduce((s, p) => s + p.porcentaje, 0);

describe("repartir", () => {
  it("ordena de mayor a menor gasto", () => {
    const r = repartir([item("Nafta", 3000), item("Súper", 9000), item("Luz", 5000)]);
    expect(r.map((p) => p.nombre)).toEqual(["Súper", "Luz", "Nafta"]);
    expect(r.map((p) => p.indice)).toEqual([0, 1, 2]);
  });

  it("los porcentajes suman 100 aunque el reparto sea feo", () => {
    // tres iguales dan 33,33 cada uno: redondeando por separado daría 99
    const r = repartir([item("A", 1000), item("B", 1000), item("C", 1000)]);
    expect(suma(r)).toBe(100);
    expect(r.map((p) => p.porcentaje).sort()).toEqual([33, 33, 34]);
  });

  it("suman 100 con muchas combinaciones incómodas", () => {
    const casos: number[][] = [
      [1, 1, 1],
      [1, 2, 3, 4, 5, 6, 7],
      [100, 3, 3, 3],
      [999999, 1],
      [7, 7, 7, 7, 7, 7, 7],
      [1, 1, 1, 1, 1, 1, 1, 1, 1],
      [50, 25, 12, 6, 3, 2, 1, 1],
    ];
    for (const montos of casos) {
      const r = repartir(montos.map((m, i) => item(`C${i}`, m)));
      expect(suma(r), `montos ${montos.join(",")}`).toBe(100);
    }
  });

  it("una categoría con plata nunca se muestra en 0 %", () => {
    // 1 centavo contra un millón: el exacto es 0,0001 %
    const r = repartir([item("Grande", 100_000_000), item("Chica", 1)]);
    const chica = r.find((p) => p.nombre === "Chica")!;
    expect(chica.porcentaje).toBe(1);
    expect(suma(r)).toBe(100);
  });

  it("descarta los que no gastaron nada", () => {
    const r = repartir([item("A", 1000), item("Cero", 0), item("Negativo", -50)]);
    expect(r.map((p) => p.nombre)).toEqual(["A"]);
    expect(r[0].porcentaje).toBe(100);
  });

  it("sin gastos, no hay porciones", () => {
    expect(repartir([])).toEqual([]);
    expect(repartir([item("A", 0)])).toEqual([]);
  });
});

describe("la cola larga se colapsa en Otras", () => {
  const muchos = (n: number) =>
    Array.from({ length: n }, (_, i) => item(`C${i}`, (n - i) * 1000));

  it("con más que el máximo + 1, agrupa el resto", () => {
    const r = repartir(muchos(12), { maximo: 6 });
    expect(r).toHaveLength(7);
    expect(r[6].clave).toBe(CLAVE_OTRAS);
    expect(r[6].esOtras).toBe(true);
    expect(r[6].nombre).toBe("Otras");
    expect(suma(r)).toBe(100);
  });

  it("Otras suma exactamente lo que esconde", () => {
    const items = muchos(12);
    const r = repartir(items, { maximo: 6 });
    const escondido = items
      .sort((a, b) => b.centavos - a.centavos)
      .slice(6)
      .reduce((s, i) => s + i.centavos, 0);
    expect(r[6].centavos).toBe(escondido);
  });

  it("NO colapsa cuando sobra una sola: Otras ocuparía su mismo lugar", () => {
    const r = repartir(muchos(7), { maximo: 6 });
    expect(r).toHaveLength(7);
    expect(r.some((p) => p.esOtras)).toBe(false);
  });

  it("Otras va última aunque su total supere al de alguna que sí entró", () => {
    const items = [
      item("Grande", 10_000),
      ...Array.from({ length: 8 }, (_, i) => item(`Chica${i}`, 900)),
    ];
    const r = repartir(items, { maximo: 2 });
    expect(r[r.length - 1].esOtras).toBe(true);
    expect(r[r.length - 1].centavos).toBeGreaterThan(r[1].centavos);
  });
});

describe("arcos", () => {
  it("el anillo cierra exactamente en 360", () => {
    const r = repartir([item("A", 1000), item("B", 1000), item("C", 1000)]);
    const a = arcos(r);
    expect(a[0].desde).toBe(0);
    expect(a[a.length - 1].hasta).toBeCloseTo(360, 6);
  });

  it("cada arco arranca donde termina el anterior", () => {
    const r = repartir([item("A", 5000), item("B", 3000), item("C", 1500)]);
    const a = arcos(r);
    for (let i = 1; i < a.length; i++) {
      expect(a[i].desde).toBeCloseTo(a[i - 1].hasta, 9);
    }
  });

  it("se calculan sobre los centavos, no sobre el porcentaje redondeado", () => {
    // 3 iguales: los porcentajes son 33/33/34 pero los arcos deben ser iguales
    const r = repartir([item("A", 1000), item("B", 1000), item("C", 1000)]);
    const a = arcos(r);
    const anchos = a.map((x) => x.hasta - x.desde);
    expect(anchos[0]).toBeCloseTo(120, 9);
    expect(anchos[1]).toBeCloseTo(120, 9);
    expect(anchos[2]).toBeCloseTo(120, 9);
  });

  it("sin porciones no hay arcos", () => {
    expect(arcos([])).toEqual([]);
  });
});
