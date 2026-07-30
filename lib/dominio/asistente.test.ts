import { describe, expect, it } from "vitest";
import {
  avisosDe,
  parsearRespuesta,
  repreguntas,
  sinAvisosRepetidos,
} from "./asistente";

describe("parsearRespuesta", () => {
  it("texto suelto queda como un solo párrafo", () => {
    const b = parsearRespuesta("Vas bien.\nTe sobra plata.");
    expect(b).toEqual([{ tipo: "texto", texto: "Vas bien.\nTe sobra plata." }]);
  });

  it("arma la tarjeta de dato con su tono", () => {
    const b = parsearRespuesta("#dato Disponible en julio | $ 564.900 | bien");
    expect(b).toEqual([
      { tipo: "dato", etiqueta: "Disponible en julio", valor: "$ 564.900", tono: "bien" },
    ]);
  });

  it("un tono inventado cae a neutro en vez de romper", () => {
    const b = parsearRespuesta("#dato Total | $ 100 | fucsia");
    expect(b[0]).toMatchObject({ tono: "neutro" });
  });

  it("la partida calcula el progreso para la barra", () => {
    const b = parsearRespuesta("#partida Supermercado | $ 268.400 | $ 520.000");
    expect(b[0]).toEqual({
      tipo: "partida",
      nombre: "Supermercado",
      gastado: "$ 268.400",
      asignado: "$ 520.000",
      progreso: 26840000 / 52000000,
    });
  });

  it("una partida excedida no pasa de 1: la barra no se desborda", () => {
    const b = parsearRespuesta("#partida Delivery | $ 120.000 | $ 90.000");
    expect(b[0]).toMatchObject({ progreso: 1 });
  });

  it("sin importes parseables la partida se muestra sin barra", () => {
    const b = parsearRespuesta("#partida Nafta | bastante | un montón");
    expect(b[0]).toMatchObject({ tipo: "partida", progreso: null });
  });

  it("intercala texto y bloques conservando el orden", () => {
    const b = parsearRespuesta(
      ["Vas bien.", "#dato Disponible | $ 100 | bien", "Ojo con esto:", "#ojo Cierra mañana"].join("\n"),
    );
    expect(b.map((x) => x.tipo)).toEqual(["texto", "dato", "texto", "ojo"]);
  });

  it("NUNCA pierde contenido: un marcador mal formado se lee como texto", () => {
    const b = parsearRespuesta("#dato SinValor");
    expect(b).toEqual([{ tipo: "texto", texto: "#dato SinValor" }]);
  });

  it("un marcador desconocido también cae a texto", () => {
    const b = parsearRespuesta("#grafico algo");
    expect(b).toEqual([{ tipo: "texto", texto: "#grafico algo" }]);
  });

  it("mientras streamea retiene el marcador incompleto para que no titile", () => {
    const b = parsearRespuesta("Vas bien.\n#dat", { parcial: true });
    expect(b).toEqual([{ tipo: "texto", texto: "Vas bien." }]);
  });

  it("cerrado el stream, esa misma línea ya se evalúa", () => {
    const b = parsearRespuesta("Vas bien.\n#dato Total | $ 10 | bien");
    expect(b.map((x) => x.tipo)).toEqual(["texto", "dato"]);
  });
});

describe("repreguntas", () => {
  it("saca las que propuso el modelo, hasta tres", () => {
    const b = parsearRespuesta("#luego ¿Y la tarjeta? | ¿Qué recorto? | ¿Cuánto ahorré? | de más");
    expect(repreguntas(b)).toEqual(["¿Y la tarjeta?", "¿Qué recorto?", "¿Cuánto ahorré?"]);
  });

  it("sin bloque #luego devuelve vacío", () => {
    expect(repreguntas(parsearRespuesta("Vas bien."))).toEqual([]);
  });
});

describe("sinAvisosRepetidos — el modelo repite el cartel, el parser no", () => {
  const bloques = parsearRespuesta(
    ["#ojo La Visa Galicia cierra hoy", "#dato Total | $ 100 | bien"].join("\n"),
  );

  it("saca el aviso que ya está más arriba en la conversación", () => {
    const r = sinAvisosRepetidos(bloques, ["La Visa Galicia cierra hoy"]);
    expect(r.map((b) => b.tipo)).toEqual(["dato"]);
  });

  it("lo reconoce aunque lo reescriba con otra puntuación o tildes", () => {
    const r = sinAvisosRepetidos(bloques, ["la visa galicia cierra hoy!"]);
    expect(r.map((b) => b.tipo)).toEqual(["dato"]);
  });

  it("un aviso nuevo sí pasa", () => {
    const r = sinAvisosRepetidos(bloques, ["Otra cosa distinta"]);
    expect(r.map((b) => b.tipo)).toEqual(["ojo", "dato"]);
  });

  it("nunca toca los otros bloques", () => {
    const b = parsearRespuesta("#dato Total | $ 100 | bien\n#luego ¿Y?");
    expect(sinAvisosRepetidos(b, [])).toEqual(b);
  });
});

describe("avisosDe", () => {
  it("junta los textos de los #ojo", () => {
    const b = parsearRespuesta("#ojo Uno\nTexto\n#ojo Dos");
    expect(avisosDe(b)).toEqual(["Uno", "Dos"]);
  });
});
