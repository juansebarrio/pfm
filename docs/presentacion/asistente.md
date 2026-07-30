# El asistente — material para la página de presentación

Capturas y copy listos para usar. Todo lo que está entre comillas se puede
pegar tal cual: está escrito en la voz de la app (rioplatense, sobrio, sin
inflar). Los números que aparecen en las capturas son reales, del hogar de
demo. Todas las capturas son en **tema oscuro**.

---

## 1. El argumento en una línea

> **No es un chatbot al que le contás tu vida. Ya sabe tus números.**

Alternativas según el tono de la sección:

- «Abrilo y te dice cómo venís. Sin escribir nada.»
- «Sacale una foto al ticket. El resto lo hace él.»
- «Un asesor que ya leyó tu presupuesto antes de que preguntes.»
- «Preguntale a tus números, no a internet.»

---

## 2. Qué aporta (los cuatro pilares)

### Abre él, no vos

Todo asistente de IA arranca con una pantalla en blanco y un «¿en qué te puedo
ayudar?». Este no: cuando entrás, **ya leyó tu mes y te dice cómo venís**.
Porque tiene tus datos, la pregunta de arranque la pone él.

> «No empieza con una pantalla en blanco. Empieza con tu mes.»

### Lee comprobantes: la foto se convierte en el movimiento

Le sacás una foto a un ticket, le mandás el screenshot de un mail de compra o
el comprobante de una transferencia, y **te devuelve el movimiento armado**:
comercio, importe, fecha, con qué tarjeta se pagó y en qué categoría va. Vos
tocás «Cargar».

Lo que lo separa de un OCR: no lee la imagen en el vacío, la lee **contra tus
datos**. El ticket dice «TARJ. ****4321» y él sabe que esa es tu Visa Galicia.
Dice «Coto» y sabe que tenés una categoría Supermercado. Un lector de texto te
da un número; este te da un movimiento.

> «Sacale una foto al ticket y confirmá. Eso es toda la carga.»

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
cerrar, los últimos movimientos, tus cuentas y tarjetas, tus categorías y el
patrimonio. Ese resumen viaja junto con tu pregunta.

**Cómo responde.** El modelo escribe texto, pero además puede pedir bloques
visuales —una cifra, una partida con su barra, un aviso, un comprobante leído—
que la app dibuja con sus propios componentes. Los importes van copiados
exactos del resumen: **el modelo no hace cuentas de plata**, solo elige qué
mostrar.

**Qué propone después.** Cada respuesta termina sugiriendo dos o tres
repreguntas, atadas a lo que acaba de decir. No son cuatro botones fijos: si te
habló de la tarjeta, te ofrece seguir por ahí.

### El comprobante, en detalle

1. **Sacás la foto** (o elegís una de la galería, o mandás un screenshot). La
   imagen se reduce en tu teléfono antes de salir: para leer un ticket no hace
   falta la foto de 4000 px, y así el proceso es más rápido y más barato.
2. **Lee lo que puede.** Devuelve solo los campos que leyó con seguridad. Del
   ticket del supermercado saca todo; del ticket de un kiosco que no dice con
   qué se pagó, saca el resto y **deja ese campo en blanco**.
3. **Confirmás vos.** Todo lo leído aparece editable: el comercio, el importe
   en grande, la fecha, si es gasto o ingreso, el medio, el ámbito y la
   categoría. Cambiás lo que quieras y tocás «Cargar».
4. **Si no supo qué categoría es, se carga igual** y cae en la bandeja de
   entrada, que es donde ya viven los movimientos sin clasificar. El botón lo
   dice: «Cargar a la bandeja».

### Lo que NO hace (importante en un producto de finanzas)

- **No carga nada solo.** Aunque haya leído los seis campos perfectos, espera
  tu toque. Un número mal leído que entra sin que lo veas es peor que no tener
  la feature.
- **No inventa lo que no leyó.** Un campo dudoso queda vacío y la app te lo
  pide. No supone la tarjeta porque es la que más usás, ni pone la fecha de hoy
  cuando el ticket no la muestra.
- **No guarda tus fotos.** La imagen se lee y se descarta: no queda en el
  teléfono, ni en el servidor, ni en la base, ni adjunta al gasto. Del
  comprobante sobrevive solo lo que confirmaste cargar.
- **No arma series de cuotas desde una foto.** Si el comprobante dice «6
  cuotas», te avisa y carga un movimiento por el total. Seis filas mal cargadas
  son un problema seis veces más grande.
- **No guarda la conversación.** Cerrás la pantalla y se termina.
- **No recomienda dónde invertir.** Explica cómo funciona el interés de la
  tarjeta o el método de sobres, pero no te dice qué comprar o vender; para eso
  te sugiere un asesor matriculado ante la CNV.
- **La clave de la IA nunca está en tu teléfono.** Las consultas pasan por
  nuestro servidor; la app nunca la ve.
- **Tus datos no entrenan modelos.** Anthropic no entrena con lo que recibe por
  su API.

> Copy corto para un bloque de confianza:
> «Las fotos se leen y se descartan. La conversación no se guarda. Nada se
> carga sin que lo confirmes. Es tu presupuesto explicado, nada más.»

---

## 4. Las capturas

Están en esta misma carpeta, 1170×2532 (iPhone, @3x), tema oscuro.

| Archivo | Qué muestra | Dónde usarla |
|---|---|---|
| `asistente-1-apertura.png` | La lectura de apertura: entrás y ya te dice cómo venís, con el disponible del mes | **Hero** de la sección del asistente |
| `asistente-2-partida.png` | Una repregunta respondida con la partida y su barra, más las repreguntas nuevas | Segundo cuadro: la conversación y los bloques visuales |
| `asistente-3-adjunto.png` | El comprobante ya elegido, listo para mandar, con la miniatura en el compositor | Primer cuadro de la secuencia del comprobante |
| `asistente-4-comprobante.png` | **La tarjeta de confirmación**: comercio, importe grande, fecha, medio y categoría ya elegidos, y el botón «Cargar» | **La captura más importante de la feature nueva** |

Para una animación o un carrusel, la secuencia natural es
**3 → 4**: la foto entra, el movimiento sale.

### Epígrafes sugeridos

- Apertura: «Entrás y ya sabe cómo venís. No escribiste nada todavía.»
- Partida: «Te contesta con la barra de tu presupuesto, no con un párrafo lleno
  de números.»
- Adjunto: «El ticket que sacaste, listo para mandar.»
- Comprobante: «Leyó el total, la fecha y con qué tarjeta pagaste. Vos solo
  confirmás.»

### Detalles para el ojo fino

- En `asistente-2-partida.png`, el aviso de la Visa aparece **una sola vez**
  aunque la respuesta vuelva a hablar de la tarjeta. Está hecho a propósito: la
  app no redibuja un cartel que ya está en pantalla.
- En `asistente-4-comprobante.png`, fijate que **«Visa •• 4321» y
  «Supermercado» ya están seleccionados**. Eso no lo eligió el usuario: salió de
  cruzar lo que dice el ticket con los medios y categorías que ya existen en el
  hogar. Es la diferencia entre leer una imagen y entender un gasto.
- El ticket de la captura es **armado a mano**
  (`muestra-ticket.html` / `.png` en esta carpeta), no la foto del ticket real
  de nadie. Los datos coinciden con el hogar de demo a propósito.

### Para la animación del agente de IA

La feature del comprobante es la que mejor se cuenta en movimiento, porque
tiene un antes y un después claros:

1. Una mano sacando la foto de un ticket (o el ticket entrando en cuadro).
2. La miniatura apareciendo en el compositor.
3. La tarjeta de confirmación armándose campo por campo — y el momento clave:
   los chips **Visa •• 4321** y **Supermercado** encendiéndose solos.
4. El toque en «Cargar» y el movimiento apareciendo en la lista.

El beat que hay que subrayar es el 3: ahí se ve que el asistente no está
transcribiendo una imagen, está reconociendo TU tarjeta y TU categoría. Todo lo
demás lo hace cualquier OCR.

---

## 5. Cómo regenerar las capturas

Con la app corriendo en `:3000`:

```bash
pnpm tsx --env-file=.env.local scripts/capturas-asistente.ts
```

El script entra con la sesión del hogar de demo, fuerza el tema oscuro (el tema
va por `data-tema` en el `<html>`, no por `prefers-color-scheme`), **sube el
ticket de muestra por el input real** con `DOM.setFileInputFiles`, y espera a
que cada respuesta termine de escribirse — no usa esperas fijas: espera a que
aparezcan las repreguntas y, en el comprobante, a que exista el campo de
importe. Para tomarlas de producción:

```bash
BASE_CAPTURAS=https://pfm-mu.vercel.app pnpm tsx --env-file=.env.local scripts/capturas-asistente.ts
```

Ojo: las respuestas las escribe un modelo, así que **el texto cambia en cada
corrida**. Los números no: salen de la base. Y el ticket de muestra tampoco: si
querés cambiarlo, editá `muestra-ticket.html` y volvé a renderizarlo.

---

## 6. Cómo se prueba que lee bien

Hay un script que le manda tres comprobantes distintos al modelo real y
verifica lo que devuelve, campo por campo:

```bash
pnpm tsx --env-file=.env.local scripts/prueba-comprobantes.ts <carpeta>
```

Los tres casos están elegidos porque cada uno tiene una trampa:

| Comprobante | La trampa | Qué tiene que hacer |
|---|---|---|
| Ticket fiscal de supermercado | Tiene subtotal, IVA discriminado y total | Dar el **total**, no el subtotal ni el IVA |
| Mail de Mercado Libre | El producto sale $ 89.999 pero con descuento se pagó $ 82.900, en 6 cuotas | Dar el **total pagado** y detectar las cuotas |
| Transferencia recibida | Es plata que entra, no que sale | Marcarlo **ingreso**, no gasto |

Y dos imágenes que **no** son comprobantes, para verificar lo contrario: que no
invente un movimiento donde no hay ninguno.
