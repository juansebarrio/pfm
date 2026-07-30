import { describe, expect, it } from "vitest";
import {
  diasDelMes,
  mesAnterior,
  mesDe,
  mesDesdeParametro,
  mesSiguiente,
  ultimoDiaDelMes,
} from "./fechas";

// fechas.ts no tenía test propio. Se agrega junto con ultimoDiaDelMes, que nace
// de un bug real: el tope de un rango mensual se escribía `${mes}-31`, y
// Postgres rechaza "2026-02-31" con "date/time field value out of range". Como
// el llamador no miraba el error, el totalizador mostraba $ 0 en los cinco
// meses que no tienen 31 días. Los casos de abajo son exactamente esos meses.

describe("ultimoDiaDelMes", () => {
  it("cierra bien los meses de 31", () => {
    expect(ultimoDiaDelMes("2026-01-01")).toBe("2026-01-31");
    expect(ultimoDiaDelMes("2026-07-01")).toBe("2026-07-31");
    expect(ultimoDiaDelMes("2026-12-01")).toBe("2026-12-31");
  });

  it("cierra bien los de 30 — los que rompían la consulta", () => {
    expect(ultimoDiaDelMes("2026-04-01")).toBe("2026-04-30");
    expect(ultimoDiaDelMes("2026-06-01")).toBe("2026-06-30");
    expect(ultimoDiaDelMes("2026-09-01")).toBe("2026-09-30");
    expect(ultimoDiaDelMes("2026-11-01")).toBe("2026-11-30");
  });

  it("febrero, con y sin bisiesto", () => {
    expect(ultimoDiaDelMes("2026-02-01")).toBe("2026-02-28");
    expect(ultimoDiaDelMes("2024-02-01")).toBe("2024-02-29");
    expect(ultimoDiaDelMes("2000-02-01")).toBe("2000-02-29"); // divisible por 400
    expect(ultimoDiaDelMes("1900-02-01")).toBe("1900-02-28"); // por 100 pero no 400
  });

  it("no le importa qué día del mes le pasen", () => {
    expect(ultimoDiaDelMes("2026-02-17")).toBe("2026-02-28");
  });

  it("nunca devuelve un día que no exista", () => {
    for (let m = 1; m <= 12; m++) {
      const mes = `2026-${String(m).padStart(2, "0")}-01`;
      const dia = Number(ultimoDiaDelMes(mes).slice(8));
      expect(dia).toBe(diasDelMes(mes));
      expect(dia).toBeGreaterThanOrEqual(28);
      expect(dia).toBeLessThanOrEqual(31);
    }
  });
});

describe("mesDesdeParametro", () => {
  it("acepta las dos formas que conviven en la app", () => {
    // la corta la escribe el navegador de meses; la larga, el resto de los links
    expect(mesDesdeParametro("2026-06")).toBe("2026-06-01");
    expect(mesDesdeParametro("2026-06-01")).toBe("2026-06-01");
  });

  it("rechaza lo que no es un mes", () => {
    expect(mesDesdeParametro(undefined)).toBeNull();
    expect(mesDesdeParametro("")).toBeNull();
    expect(mesDesdeParametro("2026-13")).toBeNull();
    expect(mesDesdeParametro("2026-00")).toBeNull();
    expect(mesDesdeParametro("2026-06-15")).toBeNull(); // un día suelto no es un mes
    expect(mesDesdeParametro("junio")).toBeNull();
    expect(mesDesdeParametro("2026")).toBeNull();
  });

  it("cubre los doce meses", () => {
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, "0");
      expect(mesDesdeParametro(`2026-${mm}`)).toBe(`2026-${mm}-01`);
    }
  });
});

describe("navegación entre meses", () => {
  it("avanza y retrocede dentro del año", () => {
    expect(mesSiguiente("2026-07-01")).toBe("2026-08-01");
    expect(mesAnterior("2026-07-01")).toBe("2026-06-01");
  });

  it("cruza el año en los dos sentidos", () => {
    expect(mesSiguiente("2026-12-01")).toBe("2027-01-01");
    expect(mesAnterior("2026-01-01")).toBe("2025-12-01");
  });

  it("ida y vuelta devuelve el mismo mes, todo el año", () => {
    for (let m = 1; m <= 12; m++) {
      const mes = `2026-${String(m).padStart(2, "0")}-01`;
      expect(mesAnterior(mesSiguiente(mes))).toBe(mes);
      expect(mesSiguiente(mesAnterior(mes))).toBe(mes);
    }
  });

  it("mesDe normaliza cualquier día al primero", () => {
    expect(mesDe("2026-07-29")).toBe("2026-07-01");
    expect(mesDe("2026-07-01")).toBe("2026-07-01");
  });
});
