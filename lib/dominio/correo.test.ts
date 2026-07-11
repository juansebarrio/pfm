import { describe, expect, it } from "vitest";
import {
  extraerTransaccion,
  importeArATextoCentavos,
  nombreDeRemitente,
} from "./correo";

// Fixtures aproximados a los avisos reales de consumo argentinos. El parser es
// heurístico: estos tests fijan el contrato de qué SÍ se detecta y qué se
// ignora (marketing, resúmenes, USD).

const MP_PAGO = {
  remitente: "Mercado Pago <info@mercadopago.com>",
  asunto: "Pagaste $ 6.800 a Café Cuervo",
  cuerpo:
    "Hola Juanse. Pagaste $ 6.800 a Café Cuervo con dinero en tu cuenta.\nOperación #12345678.",
};

const MP_RECIBIDO = {
  remitente: "Mercado Pago <info@mercadopago.com>",
  asunto: "Recibiste una transferencia",
  cuerpo: "Recibiste $ 52.000 de Valentina Gómez. Ya está disponible en tu cuenta.",
};

const BBVA_CONSUMO = {
  remitente: "BBVA Argentina <avisos@bbva.com.ar>",
  asunto: "Aviso de consumo con tu tarjeta",
  cuerpo:
    "Te informamos que se realizó un consumo con tu tarjeta de crédito terminada en 8810.\nComercio: compra aprobada en YPF ACA CENTRO por $ 45.000,00 el 10/07/2026.",
};

const GALICIA_COMPRA = {
  remitente: "Banco Galicia <avisos@galicia.com.ar>",
  asunto: "Compra aprobada",
  cuerpo: "Compra aprobada en COTO CICSA 141 por $ 84.320,50 con tu Visa terminada en 4321.",
};

const UALA_PAGO = {
  remitente: "Ualá <hola@uala.com.ar>",
  asunto: "Hiciste una compra",
  cuerpo: "Hiciste una compra en RAPPI ARG por $ 12.350 con tu tarjeta Ualá.",
};

const PROMO = {
  remitente: "Banco Galicia <promos@galicia.com.ar>",
  asunto: "3 cuotas sin interés en supermercados",
  cuerpo: "Aprovechá 20 % de descuento y 3 cuotas sin interés pagando con tu Visa. Tope $ 15.000.",
};

const RESUMEN_DISPONIBLE = {
  remitente: "Mastercard <avisos@mastercard.com.ar>",
  asunto: "Tu resumen ya está disponible",
  cuerpo: "El resumen de tu tarjeta ya se encuentra disponible para consultar en el home banking.",
};

const CONSUMO_USD = {
  remitente: "BBVA Argentina <avisos@bbva.com.ar>",
  asunto: "Aviso de consumo",
  cuerpo: "Se realizó un consumo con tu tarjeta terminada en 8810 en NETFLIX.COM por U$S 15,99.",
};

// consumo real con footer promocional: NO debe descartarse (marketing solo en asunto)
const CONSUMO_CON_FOOTER = {
  remitente: "Banco Galicia <avisos@galicia.com.ar>",
  asunto: "Compra aprobada",
  cuerpo:
    "Compra aprobada en COTO CICSA 141 por $ 84.320,50 con tu Visa terminada en 4321.\n\nConocé todos los descuentos y promociones con tus tarjetas Galicia. Beneficio exclusivo.",
};

const CONSUMO_FORMATO_US = {
  remitente: "Google <payments@google.com>",
  asunto: "Tu pago fue procesado",
  cuerpo: "Se debitó de tu cuenta el pago de $ 1,500.00 por tus servicios.",
};

const CONSUMO_SUFIJO_AR = {
  remitente: "Banco Nación <avisos@bna.com.ar>",
  asunto: "Débito en tu cuenta",
  cuerpo: "Se debitó de tu cuenta la suma de $ 1.500.- en concepto de mantenimiento.",
};

const CONSUMO_PUNTO_FINAL = {
  remitente: "Mercado Pago <info@mercadopago.com>",
  asunto: "Pagaste en un comercio",
  cuerpo: "Pagaste $ 6.800 a Café Cuervo. Gracias por usar Mercado Pago.",
};

const CONSUMO_USD_SUFIJO = {
  remitente: "BBVA Argentina <avisos@bbva.com.ar>",
  asunto: "Aviso de consumo",
  cuerpo: "Se realizó un consumo en NETFLIX.COM por $ 20,00 USD con tu tarjeta terminada en 8810.",
};

const CONSUMO_USD_ETIQUETA = {
  remitente: "BBVA Argentina <avisos@bbva.com.ar>",
  asunto: "Aviso de consumo",
  cuerpo: "Consumo en SPOTIFY. Importe USD: $ 15,99. Tarjeta terminada en 8810.",
};

const CONSUMO_EXTERIOR = {
  remitente: "BBVA Argentina <avisos@bbva.com.ar>",
  asunto: "Consumo en el exterior",
  cuerpo: "Se realizó un consumo en el exterior con tu tarjeta terminada en 8810 por $ 5.000,00.",
};

describe("extraerTransaccion", () => {
  it("detecta un pago de Mercado Pago con comercio", () => {
    expect(extraerTransaccion(MP_PAGO)).toEqual({
      tipo: "gasto",
      importeCentavos: 680000,
      comercio: "Café Cuervo",
      ultimos4: null,
    });
  });

  it("detecta una transferencia recibida como ingreso", () => {
    expect(extraerTransaccion(MP_RECIBIDO)).toEqual({
      tipo: "ingreso",
      importeCentavos: 5200000,
      comercio: "Valentina Gómez",
      ultimos4: null,
    });
  });

  it("detecta un consumo de tarjeta con últimos 4 y decimales", () => {
    expect(extraerTransaccion(BBVA_CONSUMO)).toEqual({
      tipo: "gasto",
      importeCentavos: 4500000,
      comercio: "YPF ACA CENTRO",
      ultimos4: "8810",
    });
  });

  it("detecta compra con centavos y tarjeta (84.320,50)", () => {
    expect(extraerTransaccion(GALICIA_COMPRA)).toEqual({
      tipo: "gasto",
      importeCentavos: 8432050,
      comercio: "COTO CICSA 141",
      ultimos4: "4321",
    });
  });

  it("detecta compra de billetera sin últimos 4", () => {
    expect(extraerTransaccion(UALA_PAGO)).toEqual({
      tipo: "gasto",
      importeCentavos: 1235000,
      comercio: "RAPPI ARG",
      ultimos4: null,
    });
  });

  it("ignora marketing aunque tenga importes", () => {
    expect(extraerTransaccion(PROMO)).toBeNull();
  });

  it("ignora avisos sin importe (resumen disponible)", () => {
    expect(extraerTransaccion(RESUMEN_DISPONIBLE)).toBeNull();
  });

  it("ignora consumos en dólares (MVP solo ARS)", () => {
    expect(extraerTransaccion(CONSUMO_USD)).toBeNull();
  });

  it("NO descarta un consumo real por el footer promocional del banco", () => {
    expect(extraerTransaccion(CONSUMO_CON_FOOTER)).toEqual({
      tipo: "gasto",
      importeCentavos: 8432050,
      comercio: "COTO CICSA 141",
      ultimos4: "4321",
    });
  });

  it("ignora el formato US 1,500.00 en vez de leerlo ÷1000", () => {
    // antes devolvía $ 1,50; ahora lo rechaza entero
    expect(extraerTransaccion(CONSUMO_FORMATO_US)).toBeNull();
  });

  it("lee el sufijo argentino '.-' ($ 1.500.-)", () => {
    expect(extraerTransaccion(CONSUMO_SUFIJO_AR)?.importeCentavos).toBe(150000);
  });

  it("lee un importe a fin de oración ($ 6.800.)", () => {
    expect(extraerTransaccion(CONSUMO_PUNTO_FINAL)).toEqual({
      tipo: "gasto",
      importeCentavos: 680000,
      comercio: "Café Cuervo",
      ultimos4: null,
    });
  });

  it("ignora dólares con la moneda declarada después del monto ($ 20,00 USD)", () => {
    expect(extraerTransaccion(CONSUMO_USD_SUFIJO)).toBeNull();
  });

  it("ignora dólares con la moneda como etiqueta antes (Importe USD: $ …)", () => {
    expect(extraerTransaccion(CONSUMO_USD_ETIQUETA)).toBeNull();
  });

  it("no toma 'el exterior' como comercio", () => {
    const t = extraerTransaccion(CONSUMO_EXTERIOR);
    expect(t?.importeCentavos).toBe(500000);
    expect(t?.comercio).toBeNull();
  });

  it("ignora mails sin frase transaccional aunque haya plata", () => {
    expect(
      extraerTransaccion({
        remitente: "Newsletter <news@finanzas.com>",
        asunto: "El dólar cerró a $ 1.470",
        cuerpo: "Análisis del mercado cambiario de hoy.",
      }),
    ).toBeNull();
  });
});

describe("importeArATextoCentavos", () => {
  it("parsea miles con punto y decimales con coma", () => {
    expect(importeArATextoCentavos("84.320,50")).toBe(8432050);
    expect(importeArATextoCentavos("1.234")).toBe(123400);
    expect(importeArATextoCentavos("980,5")).toBe(98050);
    expect(importeArATextoCentavos("45.000,00")).toBe(4500000);
    expect(importeArATextoCentavos("12350")).toBe(1235000);
  });

  it("rechaza formatos rotos o fuera de rango", () => {
    expect(importeArATextoCentavos("12.34")).toBeNull(); // miles mal agrupados
    expect(importeArATextoCentavos("0")).toBeNull();
    expect(importeArATextoCentavos("1,234")).toBeNull(); // 3 decimales
    expect(importeArATextoCentavos("")).toBeNull();
    expect(importeArATextoCentavos("999.999.999.999")).toBeNull(); // > tope
  });
});

describe("nombreDeRemitente", () => {
  it("extrae el nombre visible", () => {
    expect(nombreDeRemitente('"Mercado Pago" <info@mercadopago.com>')).toBe("Mercado Pago");
    expect(nombreDeRemitente("BBVA Argentina <avisos@bbva.com.ar>")).toBe("BBVA Argentina");
    expect(nombreDeRemitente("avisos@bbva.com.ar")).toBe("avisos@bbva.com.ar");
  });
});
