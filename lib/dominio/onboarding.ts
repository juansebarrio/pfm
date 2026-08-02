// El recorrido de bienvenida: qué hace la app, contado una sola vez.
//
// Vive en el dominio compartido para que la web y el nativo cuenten EXACTAMENTE
// lo mismo — un onboarding que difiere entre plataformas es un bug de copy.
// Cada paso es un ícono (por nombre: cada plataforma lo resuelve con su set),
// un título y un párrafo. Seis pasos y no más: un onboarding largo no se lee,
// se saltea.
//
// El tono es el de la app (voseo, concreto, sin inflar) y cada paso termina en
// algo ACCIONABLE: qué toca el usuario para usar eso que le contamos.

export type PasoOnboarding = {
  /** nombre del ícono, resuelto por cada plataforma (lucide) */
  icono: string;
  titulo: string;
  cuerpo: string;
};

export const CLAVE_ONBOARDING = "fdm-onboarding-visto";

export const PASOS_ONBOARDING: PasoOnboarding[] = [
  {
    icono: "wallet",
    titulo: "Presupuesto por sobres",
    cuerpo:
      "Cada mes le ponés un monto a cada partida, como sobres de plata. El Resumen te dice cuánto queda en total y cuánto en cada sobre, para llegar sin sobresaltos a fin de mes.",
  },
  {
    icono: "camera",
    titulo: "Cargá gastos en segundos",
    cuerpo:
      "El botón verde de abajo tiene dos mitades. Con el + cargás a mano: importe, categoría, listo. Con la cámara le sacás una foto al ticket y el asistente arma el movimiento — vos solo confirmás.",
  },
  {
    icono: "inbox",
    titulo: "La bandeja de entrada",
    cuerpo:
      "Lo que entra sin categoría no se pierde: espera en la bandeja, arriba de Movimientos. Un toque para elegirle categoría y pasa al historial y al presupuesto.",
  },
  {
    icono: "credit-card",
    titulo: "Tarjetas como las de acá",
    cuerpo:
      "Cierre, vencimiento y cuotas de verdad: cada consumo cae en el resumen que corresponde y las cuotas devengan mes a mes. La app te avisa antes de que cierre la tarjeta.",
  },
  {
    icono: "lock",
    titulo: "Del hogar o solo tuyo",
    cuerpo:
      "Lo compartido lo ven los adultos del hogar. Lo personal es tuyo: no aparece en las listas ni en los totales de nadie más. Lo elegís al cargar cada movimiento.",
  },
  {
    icono: "sparkles",
    titulo: "Preguntale a tus números",
    cuerpo:
      "El asistente abre diciéndote cómo venís y contesta con tus datos reales: cuánto va el súper, si te conviene pagar el total de la tarjeta, qué podés recortar.",
  },
];
