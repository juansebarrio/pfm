# DESIGN_NOTES — Sobres

Bitácora de decisiones de implementación, mejoras aplicadas y propuestas pendientes.
La auditoría completa del export está en `DESIGN_AUDIT.md`. Regla de jerarquía: en lo
visual gana el export; en lo funcional y de datos gana el brief. Todo choque queda
anotado acá.

---

## 1. Decisiones anotadas (ambigüedades resueltas sin frenar)

### 1.1 Cuotas del Aire acondicionado: 5/12, no 4/12
Los tres datos del export no cierran entre sí: el badge dice `CUOTA 4/12` (pantallas
06 y 07), la fila de 07 dice `termina feb 2027` y el gráfico + copy dicen `en marzo
quedás libre` (barras sep–feb comprometidas, mar–jul libres). Con cuota 4 en julio,
la 12.ª caería en marzo 2027 y quedarías libre en abril. Con cuota 5 en julio cierran
el "termina feb 2027", el "en marzo quedás libre", el comprometido de agosto
($ 339.550 = Aire 86.250 + Notebook 210.000 + Zapatillas 43.300) y el "desde sep
$ 86.250". **Decisión conservadora: el seed pone la compra el 1 de marzo de 2026 →
julio es la cuota 5/12.** Divergencia visible contra el export: los dos badges
mostrarán `CUOTA 5/12`. Elegimos que 2 de los 3 datos + toda la aritmética cierren,
porque acá todo se deriva de datos y no hay números pintados.

### 1.2 Total de patrimonio: suma real con ≈
El export muestra `$ 47.400.000` pero la suma exacta de las tenencias da
$ 47.388.000 (el propio export ya usa `≈ USD 32.200` para el equivalente). Como todo
número sale de datos, el total mostrará la suma real. Para el hero grande usamos
redondeo visible a la centena de mil con `≈` — mismo criterio que el USD — quedando
`$ 47.400.000` como en el export, y el detalle exacto vive en las filas.

### 1.3 Rollover de Suscripciones: la barra usa el denominador base
`queda $ 27.600 = 55.000 + 13.800 (junio) − 41.200`. Para la barra de avance se usa
el asignado base ($ 55.000 → 75 % gastado, como está dibujado en el export). El
rollover suma al disponible pero no infla el denominador visual. Coincide con el
dibujo actual (barra al 75 %).

### 1.4 "CUOTA x/N" en el ciclo = cuota que cae en ese ciclo
El movimiento hijo de una compra en cuotas se fecha el día 1 del mes y se asigna al
ciclo abierto por la regla `fecha <= fecha_cierre`. El badge muestra el índice de esa
cuota. Presupuesto por devengado: la compra impacta el mes de cada cuota devengada;
el pago del resumen jamás computa como gasto.

### 1.5 Regla del ícono ámbar en partidas
El export no la enuncia; el único caso es Luz (rayo ámbar, $ 0 gastado, `recurrente ·
vence el 18 jul`). Regla implementada: **el ícono de la partida pasa a ámbar cuando la
partida tiene un aviso activo** (recurrente que vence y todavía no se registró).
Coherente con el rayo ámbar del "Para atender" de 04.

### 1.6 Proyección lineal solo sobre partidas variables
`gastado / días transcurridos × días del mes`, aplicada a partidas no-fijas y con
gasto > 0. Las fijas pagadas al 100 % quedan "calmas" (regla anotada en el propio
export). Una partida sin gastos no proyecta (caso Luz). **Las partidas con rollover
tampoco proyectan**: son pools de arrastre (Suscripciones, Fotografía), no ritmos
diarios — proyectar un Netflix cobrado el día 3 daría atención absurda, y el export
dibuja Suscripciones en verde.

### 1.7 Los números de proyección del export están pintados
"a este ritmo terminás **$ 31.200** arriba" (Supermercado) y "**$ 7.100** arriba"
(Delivery) no salen de ninguna fórmula lineal con los datos dibujados (la fórmula
del brief da $ 312.040 y $ 131.030). En conflicto funcional gana el brief: usamos
la fórmula y los montos del copy difieren del export. Misma situación con
**Restaurantes**: $ 45.000/$ 120.000 al día 10 proyecta $ 139.500 (> asignado), la
app la muestra en atención aunque el export la pinte verde. La comparativa 1:1
contempla estas tres divergencias derivadas.

### 1.8 Regla del importe en ámbar
El export muestra "queda $ 18.700" en ámbar (Delivery, 79 % gastado) pero
"queda $ 251.600" en tinta (Supermercado, 52 %) sin enunciar la regla. Regla
implementada: el importe "queda" va en ámbar cuando la partida está en atención
**y** el gastado supera el 75 % del disponible.

---

### 1.9 Alta rápida sin campo de comercio
El export de 03 no dibuja ningún input de texto: monto, medio, ciclo/cuotas,
categorías y listo. Lo respetamos — la descripción del movimiento toma el nombre
de la categoría (o "Gasto" sin categoría) y se podrá editar después. Sumar un
campo de comercio opcional queda como **propuesta** (cambia el flujo de la
pantalla más usada; el export prioriza velocidad).

### 1.10 Armado del mes: redondeo y overrides
El ajuste por inflación redondea cada partida a $ 25 (el export: 780.000 ×
1,025 = 799.500 ✓) y se calcula con aritmética entera en décimas de punto.
Editar un monto a mano lo fija (override): cambiar el % general recalcula solo
las filas no tocadas; "Copiar sin ajuste" descarta ajuste y overrides.

### 1.11 Onboarding sin fricción
Un usuario nuevo sin hogar recibe automáticamente "Mi hogar" + las 15
categorías sugeridas al primer ingreso (el nombre se edita en /hogar). El CTA
de 01c ("Empezar con julio") arma el mes desde esas categorías en $ 0.

### 1.12 Tarjetas: decisiones de la tanda 5
- **Hitos confirmados en el timeline**: el export solo dibuja el estado estimado
  (punteado ámbar); confirmado = borde sólido tinta sobre superficie ("ya es un
  hecho"), coherente con el lenguaje del sistema.
- **Confirmar fechas**: una sola hoja confirma/corrige cierre y vencimiento
  juntos (el estado `estimado/confirmado` es del ciclo). Si la fecha cambia, la
  función SQL reasigna los consumos sola.
- **Card de pago visible** cuando el ciclo está cerrado/conciliado, el cierre ya
  pasó, o vence en ≤ 7 días (umbral propio, no declarado por el export).
- **Diferencia de conciliación**: verde si |diferencia| ≤ 5 % del proyectado,
  ámbar si es mayor (el export pide "verde si la diferencia es chica" sin
  cuantificar).
- **Orden de compras en 07**: por cuota mensual descendente (el export lista el
  Aire primero; derivamos por peso, decisión anotada).

### 1.13 Hogar: decisiones de la tanda 6
- **Hogar activo = el último al que te sumaste**: quien acepta una invitación
  después de haber recibido su hogar automático aterriza en el hogar compartido.
- **"Cerrar sesión"** al pie de /hogar: el export no lo dibuja; necesario para
  operar con dos usuarios. Sobrio, texto rojo.
- La página de invitación (`/invitacion/[token]`) es un hueco no dibujado:
  construida con el sistema (estado vacío + card), sin inventar de más.
- El login/registro aceptan `?volver=` (ruta interna validada) para retomar la
  invitación después de autenticarse.

### 1.14 Patrimonio y cuentas: decisiones de la tanda 7
- **Los cuatro huecos del export quedaron construidos** siguiendo el sistema:
  conciliación (tanda 5), vista Personal (verificada con el rollover de
  Fotografía), alta/edición de tenencia (hoja con lista cerrada de instrumentos
  y conversión en vivo que siempre dice qué TC usó) y gestión de cuentas
  (/cuentas detrás del avatar → /hogar → "Cuentas y tarjetas").
- Tocar el **chip de TC activo** abre la hoja de carga manual del valor del día;
  tocar otro chip cambia la fuente. Los chips sin valor cargado van
  deshabilitados.
- **"Guardar foto del mes"** es manual (upsert por día); el job automático
  (Trigger.dev) queda en fase siguiente.
- Cuentas y tarjetas **se desactivan, nunca se borran**; las inactivas quedan
  atenuadas al final con badge "inactiva". Reactivar queda como extensión
  pendiente si hace falta.

### 1.15 Ronda de fixes post-revisión adversarial (18 bugs reales)
Una revisión multi-agente (4 lentes + verificación escéptica) confirmó 18 bugs
reales; todos arreglados. Los de fondo:
- **Seguridad**: trigger que impide auto-ascenso a administrador (RLS
  `miembros_update` no tenía WITH CHECK sobre el rol); las acciones de tarjeta
  validan que la tarjeta y la cuenta sean del hogar activo; reenviar invitación
  solo opera sobre las pendientes (no resucita revocadas/aceptadas).
- **Ciclos de tarjeta** (el corazón argentino): se agregó generación automática
  de ciclos. Una tarjeta nueva se da de alta con "día de cierre" y arranca con
  su primer ciclo estimado; `asegurarCicloParaFecha()` genera los ciclos que
  falten hacia adelante para que ningún consumo ni cuota quede huérfano;
  `confirmarFechasCiclo` reasigna SIEMPRE (era solo al corregir la fecha); la
  cuota 1 se asigna con piso en la fecha real de compra (no caía en un resumen
  ya cerrado); la alta rápida muestra el mismo ciclo al que caerá el gasto; los
  recurrentes de tarjeta también resuelven su ciclo.
- **Plata/UI**: barra de partida no divide por cero con asignado $0 + rollover;
  "$ X/mes" de cuotas usa la cuota base (no la primera que carga el resto); el
  pago "Total" registra los centavos exactos; el aviso "Vence el resumen"
  desaparece al pagarlo; una tenencia USD sin TC se marca "sin TC cargado" en
  vez de $ 0; el buscador se resincroniza con la URL; una compra en cuotas exige
  categoría (si no, quedaba inalcanzable); `/gasto/nuevo` sin medios ofrece
  salida a /cuentas en vez de ser un callejón mudo.

### 1.15 Detalle y borrado de movimientos (feature post-brief)
El export no dibujaba interacción sobre las filas de movimiento; se agregó a
pedido, siguiendo el sistema:
- **Tap** en una fila del historial → abre el detalle en hoja inferior
  (importe, categoría, medio, fecha larga, ámbito, ciclo, cuota, nota) con la
  acción de borrado al pie.
- **Swipe a la izquierda** → revela un panel rojo "Borrar". `touch-action:
  pan-y` deja intacto el scroll vertical; solo se intercepta el arrastre
  horizontal. `setPointerCapture` va en try/catch por si el entorno no lo
  permite.
- **Borrar una cuota borra la compra completa** (todas sus hermanas, vía
  `on delete cascade` de `compras_en_cuotas`): una cuota suelta rompería la
  serie. El detalle lo aclara ("Borrar la compra · N cuotas") antes de
  confirmar.
- Borrado **optimista** con reversión y mensaje si el server falla.
- La bandeja conserva su gesto propio (tap = categorizar inline); el swipe/tap
  de detalle vive en el historial categorizado.
- Las cuotas del seed no tienen categoría (no pisan partidas), así que no
  aparecen en el historial; una compra en cuotas cargada por el usuario **exige
  categoría** (guard de alta rápida) y por eso sí es visible y borrable ahí.

### 1.16 Filtro por tipo en movimientos (feature post-brief)
Se agregó un chip "Tipo" en la fila de filtros de 05 (misma mecánica que
Cuenta/Categoría/Miembro): "Gastos e ingresos" (reset) · "Solo gastos" · "Solo
ingresos". Decisiones:
- Al filtrar por tipo el historial muestra **todos** los movimientos de ese tipo,
  incluidos los sin categorizar — porque los ingresos no se categorizan (las
  categorías son partidas de gasto) y, sin esto, "Solo ingresos" daría siempre
  vacío. Sin filtro de tipo, el historial sigue siendo solo lo categorizado.
- La **bandeja se oculta** cuando el filtro de tipo está activo: el historial ya
  lista todo ese tipo y así no se duplica el ingreso que estaría en la bandeja.

### 1.17 Categoría a mano y comentario en el alta rápida (feature post-brief)
El export de 03 no tenía campos de texto (decisión §1.9). A pedido se sumaron
dos, sin romper el flujo rápido (van debajo de la grilla de recientes, opcionales):
- **"Otra categoría (escribila)"**: al tipear, sugiere las categorías existentes
  del ámbito (tap para elegir). Al guardar, el server hace *find-or-create*
  case-insensitive: si el nombre ya existe lo reusa, si no crea la categoría en
  el grupo "Otros" (ícono `tag`). Escribir a mano y elegir un tile son
  mutuamente exclusivos.
- **"Comentario (opcional)"** → se guarda en `movimientos.nota` y se ve en el
  detalle del movimiento.
- El guard de "cuotas exigen categoría" ahora se satisface también con la
  categoría escrita a mano. Inputs a 16px para evitar el zoom de iOS.

## 2. Mejoras aplicadas directo (no cambian layout ni jerarquía)
Detalle completo con mediciones en `DESIGN_AUDIT.md` §7.1. Estado: se aplican durante
las tandas 1–8; esta lista se va tildando.

- [x] **Unificación de near-duplicates de color**: `#F0EDE5`/`#F0EDE6` → un solo token
  `crema-2`; ídem pares menores de la rampa detectados en la auditoría.
- [x] **Ámbar AA en claro**: `#A66A00` (4.48:1 sobre blanco) → `#8F5B00` para texto
  chico; el ámbar original queda para íconos/badges con fondo.
- [x] **Terciario AA**: `#9B958B` (2.97:1) → oscurecer a ~`#76716A` en textos
  informativos reales (placeholders, metadata de frescura, tachados).
- [x] **`$ 0` desactivado legible**: `#C9C4BA` (1.74:1) → `#A9A399`.
- [x] **Targets táctiles 44 px**: hit-area invisible en back/cerrar, chevrons, links
  chicos (`confirmar fecha`, `· actualizar`, `Reenviar/Revocar`), chips y filtros.
- [x] **Estados de foco visibles**: anillo 2px `#1E6E52` (claro) / `#4FA37F` (dark)
  offset 2px en todo lo interactivo; estados pressed sobrios.
- [x] **Labels accesibles**: aria-label en FAB `+`, backspace del teclado, chevrons de
  mes/ciclo, lápices de edición; barras de progreso con valor aria.
- [x] **Escala única de tags**: 8.5px / ls .08em / padding 2px 5px / radio 4px para
  todos los badges (hoy conviven 8/8.5/9px).
- [x] **Naming único de tarjetas**: `Visa •• 4321` / `Mastercard •• 8810`; banco solo
  en el título del detalle (corrige `MC •• 8810` y `Mastercard BBVA`).
- [x] **Guión de rango unificado**: en-dash con espacios (`29 jun – 28 jul`).
- [x] **Fade de scroll en carruseles**: medios de pago (03) y filtros (05) muestran el
  chip cortado con fade en lugar de corte seco.
- [x] **CTA primario único**: radio 12, padding vertical 15, Rubik 600 15px.
- [x] **Sombra/opacidad dark documentadas**: dark sin sombras de card; opacidad de
  barra pagada unificada en .4.

## 3. Propuestas — resueltas con el ok delegado de Juanse ("hacé lo necesario")
Detalle original en `DESIGN_AUDIT.md` §7.2. Estado final de cada una:

1. Partida **excedida** en rojo — **resuelta por la implementación**: `estadoPartida()`
   y `CardPartida` ya renderizan el estado (barra roja, monto en rojo, "te pasaste
   $ X"), validado en `/sistema` en claro y oscuro. No hacía falta tocar pantallas.
2. Frame dark con chips y estados — **resuelta por la implementación**: `/sistema`
   muestra todos los componentes en oscuro; las extrapolaciones pasaron AA
   (Lighthouse accesibilidad 100).
3. "Conciliar resumen" accionable — **APLICADA**: la fila lleva chevron de
   affordance (única de las 8 que tocaba una pantalla del export).
4. Segmented Hogar/Personal en 05 — **decidido no aplicar**: el export dibuja chips
   en la fila de filtros a propósito; en lo visual gana el export.
5. Metadata `· cierra` en 04 — **decidido no aplicar**: "corta a propósito" es la
   spec explícita del Resumen; la condensación es intencional.
6. Label `6 ago` en el timeline — **decidido no aplicar**: la fecha de vencimiento
   ya vive en el bloque inferior, como dibuja el export; duplicarla agrega ruido.
7. Grilla inline de bandeja — **resuelta por la implementación**: chips sugeridos +
   "todas →" con grilla, verificada en navegador (Rappi → Delivery sin salir).
8. Denominador del rollover — **resuelta por decisión §1.3**, que coincide con el
   dibujo del export (barra al 75 %).

Sigue pendiente de diseño (no de código): sumar un campo de comercio opcional al
alta rápida (§1.9) — no se aplica porque cambia el flujo de la pantalla más usada.

## 4. Extrapolaciones de dark mode (pantalla 10 solo valida 01a)
Los tokens dark de chips/estados no dibujados se derivan así y se validan en
`/sistema`: semánticos "aclarados" siguiendo los dos ejemplos del export
(`#A66A00→#C6913B`, `#1E6E52→#4FA37F`); fondos de chip = mezcla del color con la
superficie `#1E1C1A` manteniendo el contraste del par claro. Pendiente de revisión
visual contra criterio de Juanse (propuesta 2 de §3).

## 5. Fase siguiente (anotado, NO implementar en esta versión)
- Cotización automática de tipos de cambio (hoy: carga manual por fuente).
- Envío real de emails de invitación vía Resend (hoy: detrás de env var; sin la
  variable el link se loguea y se muestra para copiar).
- Snapshot mensual automático de patrimonio con Trigger.dev (hoy: server action
  manual "guardar foto del mes").
- Push notifications (iOS con limitaciones anotadas en README).
- Offline real (hoy: PWA instalable con SW mínimo).
- Import CSV de movimientos.

## 6. Dependencias agregadas y justificación
(ninguna pesada por ahora; gráficos con SVG propio como pide el brief)
