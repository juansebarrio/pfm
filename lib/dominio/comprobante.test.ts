import { describe, expect, it } from "vitest";
import {
  NOTA_PROCEDENCIA,
  altaDesdeComprobante,
  bloqueantes,
  elegirCategoria,
  elegirMedio,
  faltantes,
  normalizarFecha,
  parsearComprobante,
  type MedioSimple,
} from "./comprobante";
import { parsearRespuesta } from "./asistente";

const HOY = "2026-07-30";

describe("normalizarFecha — el modelo copia el formato del ticket", () => {
  it("acepta ISO", () => {
    expect(normalizarFecha("2026-07-28", HOY)).toBe("2026-07-28");
  });

  it("acepta el formato argentino, con y sin ceros y con año corto", () => {
    expect(normalizarFecha("28/07/2026", HOY)).toBe("2026-07-28");
    expect(normalizarFecha("5/7/2026", HOY)).toBe("2026-07-05");
    expect(normalizarFecha("28/07/26", HOY)).toBe("2026-07-28");
    expect(normalizarFecha("28-07-2026", HOY)).toBe("2026-07-28");
  });

  it("rechaza un día que no existe en vez de corregirlo en silencio", () => {
    // new Date(2026, 1, 31) devuelve el 3 de marzo: eso sería cargar un gasto
    // en otro mes por un OCR mal leído
    expect(normalizarFecha("31/02/2026", HOY)).toBeNull();
    expect(normalizarFecha("2026-02-30", HOY)).toBeNull();
    expect(normalizarFecha("31/04/2026", HOY)).toBeNull();
  });

  it("acepta el último día real de un mes de 30 y de febrero bisiesto", () => {
    expect(normalizarFecha("30/04/2026", HOY)).toBe("2026-04-30");
    expect(normalizarFecha("29/02/2024", HOY)).toBe("2024-02-29");
  });

  it("rechaza el futuro: un ticket no se emitió mañana", () => {
    expect(normalizarFecha("2026-07-31", HOY)).toBeNull();
    expect(normalizarFecha("2027-01-01", HOY)).toBeNull();
  });

  it("rechaza un año absurdamente viejo (dígito mal leído)", () => {
    expect(normalizarFecha("28/07/2016", HOY)).toBeNull();
  });

  it("rechaza cualquier cosa que no sea fecha", () => {
    expect(normalizarFecha("ayer", HOY)).toBeNull();
    expect(normalizarFecha("", HOY)).toBeNull();
    expect(normalizarFecha("28 de julio", HOY)).toBeNull();
  });
});

describe("parsearComprobante", () => {
  it("lee un ticket completo", () => {
    const c = parsearComprobante(
      "comercio=Coto | monto=$ 84.320 | fecha=28/07/2026 | tipo=gasto | categoria=Supermercado | medio=Visa Galicia ••4321",
      HOY,
    );
    expect(c).toEqual({
      comercio: "Coto",
      montoTexto: "$ 84.320",
      montoCentavos: 8432000,
      fecha: "2026-07-28",
      tipo: "gasto",
      categoria: "Supermercado",
      medio: "Visa Galicia ••4321",
      cuotas: null,
    });
  });

  it("el orden de los campos no importa", () => {
    const c = parsearComprobante("tipo=ingreso | monto=$ 120.000 | comercio=Sueldo", HOY);
    expect(c?.tipo).toBe("ingreso");
    expect(c?.montoCentavos).toBe(12000000);
    expect(c?.comercio).toBe("Sueldo");
  });

  it("lo que el modelo no supo simplemente no viene", () => {
    const c = parsearComprobante("comercio=Kiosco | monto=$ 2.500", HOY);
    expect(c?.fecha).toBeNull();
    expect(c?.medio).toBeNull();
    expect(c?.categoria).toBeNull();
  });

  it("trata los marcadores de 'no sé' como ausencia", () => {
    const c = parsearComprobante(
      "comercio=Kiosco | monto=$ 2.500 | categoria=— | medio=n/a | fecha=null",
      HOY,
    );
    expect(c?.categoria).toBeNull();
    expect(c?.medio).toBeNull();
    expect(c?.fecha).toBeNull();
  });

  it("una fecha inválida queda en null, no tira el comprobante entero", () => {
    const c = parsearComprobante("comercio=Coto | monto=$ 84.320 | fecha=31/02/2026", HOY);
    expect(c?.comercio).toBe("Coto");
    expect(c?.fecha).toBeNull();
  });

  it("un monto ilegible queda en null y bloquea la carga", () => {
    const c = parsearComprobante("comercio=Coto | monto=ilegible", HOY);
    expect(c?.montoCentavos).toBeNull();
    expect(bloqueantes(c!)).toContain("monto");
  });

  it("lee las cuotas solo si son más de una", () => {
    expect(parsearComprobante("monto=$ 300.000 | cuotas=6", HOY)?.cuotas).toBe(6);
    expect(parsearComprobante("monto=$ 300.000 | cuotas=1", HOY)?.cuotas).toBeNull();
    expect(parsearComprobante("monto=$ 300.000 | cuotas=varias", HOY)?.cuotas).toBeNull();
  });

  it("ignora claves inventadas por el modelo", () => {
    const c = parsearComprobante("comercio=Coto | cuit=30-12345678-9 | monto=$ 100", HOY);
    expect(c?.comercio).toBe("Coto");
    expect(c?.montoCentavos).toBe(10000);
  });

  it("sin nada aprovechable devuelve null (la línea cae a texto)", () => {
    expect(parsearComprobante("no pude leer la foto", HOY)).toBeNull();
    expect(parsearComprobante("", HOY)).toBeNull();
  });

  it("un valor con signo = adentro no se corta al medio", () => {
    const c = parsearComprobante("comercio=Compra a=b | monto=$ 100", HOY);
    expect(c?.comercio).toBe("Compra a=b");
  });
});

describe("faltantes y bloqueantes", () => {
  const completo = parsearComprobante(
    "comercio=Coto | monto=$ 84.320 | fecha=28/07/2026 | tipo=gasto | categoria=Supermercado | medio=Visa",
    HOY,
  )!;

  it("un comprobante completo no tiene nada pendiente", () => {
    expect(faltantes(completo)).toEqual([]);
    expect(bloqueantes(completo)).toEqual([]);
  });

  it("la categoría falta pero NO bloquea: eso es la bandeja de entrada", () => {
    const c = parsearComprobante(
      "comercio=Kiosco | monto=$ 2.500 | fecha=28/07/2026 | tipo=gasto | medio=Efectivo",
      HOY,
    )!;
    expect(faltantes(c)).toEqual(["categoria"]);
    expect(bloqueantes(c)).toEqual([]);
  });

  it("sin medio no se carga: adivinar en qué tarjeta cayó es peor que preguntar", () => {
    const c = parsearComprobante("comercio=Coto | monto=$ 100 | fecha=28/07/2026 | tipo=gasto", HOY)!;
    expect(bloqueantes(c)).toContain("medio");
  });

  it("devuelve los faltantes en el orden en que se resuelven", () => {
    const c = parsearComprobante("comercio=Algo", HOY)!;
    expect(faltantes(c)).toEqual(["monto", "fecha", "tipo", "medio", "categoria"]);
  });
});

describe("elegirMedio", () => {
  const medios: MedioSimple[] = [
    { id: "c1", tipo: "cuenta", nombre: "Galicia" },
    { id: "c2", tipo: "cuenta", nombre: "Efectivo" },
    { id: "t1", tipo: "tarjeta", nombre: "Visa Galicia", ultimos4: "4321" },
    { id: "t2", tipo: "tarjeta", nombre: "Mastercard BBVA", ultimos4: "8810" },
  ];

  it("matchea por los últimos 4, que es lo que imprime el ticket", () => {
    expect(elegirMedio("VISA ****4321", medios)?.id).toBe("t1");
    expect(elegirMedio("terminada en 8810", medios)?.id).toBe("t2");
  });

  it("matchea por nombre exacto, sin importar mayúsculas", () => {
    expect(elegirMedio("Efectivo", medios)?.id).toBe("c2");
    expect(elegirMedio("mastercard bbva", medios)?.id).toBe("t2");
    expect(elegirMedio("Visa Galicia", medios)?.id).toBe("t1");
  });

  it("un nombre exacto matchea aunque otro medio lo contenga", () => {
    // "Galicia" también está dentro de "Visa Galicia": gana el exacto
    expect(elegirMedio("Galicia", medios)?.id).toBe("c1");
  });

  it("los últimos 4 ganan sobre el nombre", () => {
    expect(elegirMedio("Galicia ••8810", medios)?.id).toBe("t2");
  });

  it("no adivina por parecido: un nombre aproximado se pregunta", () => {
    // el caso que hizo sacar la pasada difusa: esto matcheaba la CUENTA Galicia
    expect(elegirMedio("Galicia crédito", medios)).toBeNull();
    expect(elegirMedio("tarjeta de crédito", medios)).toBeNull();
    expect(elegirMedio("Visa", medios)).toBeNull();
  });

  it("no adivina con un número que no es de nadie", () => {
    expect(elegirMedio("VISA ****9999", medios)).toBeNull();
  });

  it("sin medio leído, null", () => {
    expect(elegirMedio(null, medios)).toBeNull();
  });
});

describe("elegirCategoria", () => {
  const categorias = [
    { id: "1", nombre: "Supermercado" },
    { id: "2", nombre: "Farmacia" },
  ];

  it("matchea sin importar tildes ni mayúsculas", () => {
    expect(elegirCategoria("supermercado", categorias)?.id).toBe("1");
    expect(elegirCategoria("FARMACIA", categorias)?.id).toBe("2");
  });

  it("una categoría que no existe no se inventa", () => {
    expect(elegirCategoria("Peluquería", categorias)).toBeNull();
    expect(elegirCategoria(null, categorias)).toBeNull();
  });
});

describe("altaDesdeComprobante", () => {
  const base = {
    montoCentavos: 8432000,
    fecha: "2026-07-28",
    tipo: "gasto" as const,
    medio: { id: "t1", tipo: "tarjeta" as const },
    categoriaId: "cat1",
    ambito: "hogar" as const,
    comercio: "Coto",
  };

  it("mapea la lectura confirmada al alta", () => {
    expect(altaDesdeComprobante(base)).toEqual({
      importeCentavos: 8432000,
      tipo: "gasto",
      medioTipo: "tarjeta",
      medioId: "t1",
      categoriaId: "cat1",
      ambito: "hogar",
      cuotas: 1,
      fecha: "2026-07-28",
      descripcion: "Coto",
      nota: NOTA_PROCEDENCIA,
    });
  });

  it("sin categoría el alta va igual: eso es la bandeja de entrada", () => {
    expect(altaDesdeComprobante({ ...base, categoriaId: null }).categoriaId).toBeNull();
  });

  it("nunca arma una serie de cuotas desde una foto", () => {
    expect(altaDesdeComprobante(base).cuotas).toBe(1);
  });

  it("sin comercio legible, una descripción según el tipo", () => {
    expect(altaDesdeComprobante({ ...base, comercio: null }).descripcion).toBe("Gasto");
    expect(altaDesdeComprobante({ ...base, comercio: "  " }).descripcion).toBe("Gasto");
    expect(
      altaDesdeComprobante({ ...base, comercio: null, tipo: "ingreso" }).descripcion,
    ).toBe("Ingreso");
  });

  it("deja escrita la procedencia: dentro de un mes hay que poder saber de dónde salió", () => {
    expect(altaDesdeComprobante(base).nota).toBe(NOTA_PROCEDENCIA);
  });
});

describe("#comprobante dentro del lenguaje de bloques", () => {
  it("se renderiza como bloque propio y el texto de al lado se conserva", () => {
    const bloques = parsearRespuesta(
      [
        "Leí el ticket.",
        "#comprobante comercio=Coto | monto=$ 84.320 | fecha=28/07/2026 | tipo=gasto",
        "#luego ¿Cómo viene el supermercado?",
      ].join("\n"),
      { hoy: HOY },
    );
    expect(bloques.map((b) => b.tipo)).toEqual(["texto", "comprobante", "luego"]);
    expect(bloques[1]).toMatchObject({
      tipo: "comprobante",
      leido: { comercio: "Coto", montoCentavos: 8432000 },
    });
  });

  it("un #comprobante vacío cae a texto: el usuario ve lo que el modelo dijo", () => {
    const bloques = parsearRespuesta("#comprobante no pude leerlo", { hoy: HOY });
    expect(bloques).toEqual([{ tipo: "texto", texto: "#comprobante no pude leerlo" }]);
  });

  it("mientras streamea no se muestra un comprobante a medio llegar", () => {
    const bloques = parsearRespuesta("Leí el ticket.\n#comprobante comercio=Co", {
      parcial: true,
      hoy: HOY,
    });
    expect(bloques.map((b) => b.tipo)).toEqual(["texto"]);
  });
});
