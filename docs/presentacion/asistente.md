# El asistente — material para la página de presentación

Capturas y copy listos para usar. Todo lo que está entre comillas se puede
pegar tal cual: está escrito en la voz de la app (rioplatense, sobrio, sin
inflar). Los números que aparecen en las capturas son reales, del hogar de
demo.

---

## 1. El argumento en una línea

> **No es un chatbot al que le contás tu vida. Ya sabe tus números.**

Alternativas según el tono de la sección:

- «Abrilo y te dice cómo venís. Sin escribir nada.»
- «Un asesor que ya leyó tu presupuesto antes de que preguntes.»
- «Preguntale a tus números, no a internet.»

---

## 2. Qué aporta (los tres pilares)

### Abre él, no vos

Todo asistente de IA arranca con una pantalla en blanco y un «¿en qué te puedo
ayudar?». Este no: cuando entrás, **ya leyó tu mes y te dice cómo venís**.
Porque tiene tus datos, la pregunta de arranque la pone él.

> «No empieza con una pantalla en blanco. Empieza con tu mes.»

### Responde con la app, no con párrafos

La respuesta no es un bloque de texto con números adentro. Es **la misma cifra
grande del Resumen, la misma barra del Presupuesto, el mismo cartel ámbar de la
tarjeta que cierra**. La IA no describe tus finanzas: arma la pantalla que
corresponde.

> «Te muestra la plata, no te la cuenta.»

### Entiende cómo funciona la plata acá

Sabe que las tarjetas tienen ciclo de cierre y vencimiento, que una compra en
cuotas devenga mes a mes, que hay plata del hogar y plata personal, y que el
patrimonio en dólares se valúa al tipo de cambio que cargaste. No traduce
consejos de otro país.

> «Ciclos de tarjeta, cuotas y dólares. Como se maneja la plata en Argentina.»

---

## 3. Cómo funciona (para la sección de detalle o el FAQ)

**Qué ve.** Antes de cada respuesta, el servidor arma un resumen de lo que la
app ya sabe: el presupuesto del mes con sus partidas, lo que está por vencer o
cerrar, los últimos movimientos y el patrimonio. Ese resumen viaja junto con tu
pregunta.

**Cómo responde.** El modelo escribe texto, pero además puede pedir bloques
visuales —una cifra, una partida con su barra, un aviso— que la app dibuja con
sus propios componentes. Los importes van copiados exactos del resumen: **el
modelo no hace cuentas de plata**, solo elige qué mostrar.

**Qué propone después.** Cada respuesta termina sugiriendo dos o tres
repreguntas, atadas a lo que acaba de decir. No son cuatro botones fijos: si te
habló de la tarjeta, te ofrece seguir por ahí.

### Lo que NO hace (importante en un producto de finanzas)

- **No guarda la conversación.** Cerrás la pantalla y se termina. No queda
  historial en ningún lado.
- **No recomienda dónde invertir.** Explica cómo funciona el interés de la
  tarjeta o el método de sobres, pero no te dice qué comprar o vender; para eso
  te sugiere un asesor matriculado ante la CNV.
- **La clave de la IA nunca está en tu teléfono.** Las consultas pasan por
  nuestro servidor; la app nunca la ve.
- **Tus datos no entrenan modelos.** Anthropic no entrena con lo que recibe por
  su API.
- **No inventa números.** Si el dato no está en tu cuenta, lo dice.

> Copy corto para un bloque de confianza:
> «La conversación no se guarda, tus datos no entrenan a nadie y no te va a
> decir qué acciones comprar. Es tu presupuesto explicado, nada más.»

---

## 4. Las capturas

Están en esta misma carpeta, 1170×2532 (iPhone, @3x), en claro y oscuro.

| Archivo | Qué muestra | Dónde usarla |
|---|---|---|
| `asistente-1-apertura-claro.png` | La lectura de apertura: entrás y ya te dice cómo venís, con el disponible del mes y la tarjeta que cierra | **La principal.** Hero de la sección del asistente |
| `asistente-2-partida-claro.png` | Una repregunta respondida con la partida y su barra, más las repreguntas nuevas | Segundo cuadro: muestra la conversación y los bloques visuales |
| `asistente-1-apertura-oscuro.png` | Lo mismo en tema oscuro | Si la landing es oscura, o para el par claro/oscuro |
| `asistente-2-partida-oscuro.png` | Lo mismo en tema oscuro | Ídem |

### Epígrafes sugeridos

- Para la apertura: «Entrás y ya sabe cómo venís. No escribiste nada todavía.»
- Para la partida: «Te contesta con la barra de tu presupuesto, no con un
  párrafo lleno de números.»

### Detalle para el ojo fino

En la segunda captura, el aviso de la Visa aparece **una sola vez** aunque la
respuesta vuelva a hablar de la tarjeta. Está hecho a propósito: la app no
redibuja un cartel que ya está en pantalla.

---

## 5. Cómo regenerar las capturas

Con la app corriendo en `:3000`:

```bash
pnpm tsx --env-file=.env.local scripts/capturas-asistente.ts
```

El script entra con la sesión del hogar de demo, espera a que la respuesta
termine de escribirse (no usa esperas fijas: espera a que aparezcan las
repreguntas), y guarda las cuatro imágenes acá. Para tomarlas de producción:

```bash
BASE_CAPTURAS=https://pfm-mu.vercel.app pnpm tsx --env-file=.env.local scripts/capturas-asistente.ts
```

Ojo: las respuestas las escribe un modelo, así que **el texto cambia en cada
corrida**. Los números no: salen de la base.
