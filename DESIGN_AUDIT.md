# Auditoría del export de diseño — Sobres

Este documento sintetiza la auditoría exhaustiva de `design/Sobres - Pantallas.dc.html`, el export de Claude Design del proyecto. El export declara "10 pantallas mobile, 390 × 844, un solo dataset: hogar Coghlan, viernes 10 de julio de 2026" (en la práctica renderiza 13 frames: los sub-estados 01a/01b/01c y 08/08b, más el frame 10 de modo oscuro). La dirección de diseño, verbatim del encabezado del canvas: **"libreta contable moderna — papel, tinta, números protagonistas."** Todo hex, px y texto citado acá sale del archivo original (las referencias `L###` son líneas de ese HTML). Las anotaciones con flecha `↳` al pie de cada frame son spec de comportamiento y se citan siempre completas y textuales. Este documento se lee así: §1 qué hay dibujado, §2 con qué tokens, §3 con qué componentes, §4 con qué datos (insumo del seed), §5–6 qué falta y qué no cierra, §7 qué se mejora, §8 a qué ruta va cada pantalla, §9 rarezas del formato `.dc`.

---

## 1. Inventario de frames

| id | Nombre | Qué muestra | Anotación ↳ (verbatim) |
|---|---|---|---|
| 00 | Encabezado del canvas *(no es pantalla)* | Logo, bajada del producto, paleta de 6 swatches, muestra tipográfica y muestrario de badges. Define la estructura común de todos los frames. | — (la bajada verbatim: "PFM personal y familiar para Argentina. 10 pantallas mobile, 390 × 844, un solo dataset: hogar Coghlan, viernes 10 de julio de 2026. Dirección: libreta contable moderna — papel, tinta, números protagonistas.") |
| 01a | Presupuesto del hogar, julio | Pantalla principal de presupuesto: hero "Disponible en julio $ 539.200", barra del mes con marcador de día, grupos Vivienda / Comida / Ahorro con partidas. | "El color de cada partida sale de la proyección, no del % gastado: una fija pagada al 100 % se ve calma. La barra del mes marca el día 10 en verde." |
| 01b | La misma pantalla, scrolleada | Mismo presupuesto con header condensado ("julio 2026 · Hogar" / "queda $ 539.200") y los grupos Ahorro / Salud / Servicios / Suscripciones (con rollover). | "Al scrollear, el header se condensa: mes y disponible siempre a la vista. El rollover de Suscripciones suma al disponible de la partida." |
| 01c | Primer uso, sin presupuesto | Estado vacío del tab Presupuesto: ícono de sobre, título, cuerpo y CTA "Empezar con julio". | "El método en una frase, sin tutorial. El CTA arma julio partiendo de partidas sugeridas." |
| 02 | Armado del presupuesto, listo en 5 minutos | Flujo modal de armado de agosto: ajuste por inflación "+ 2,5 %", lista de partidas con toggle y monto editable, footer fijo con total en vivo. | "El total se actualiza en vivo: $ 2.931.500 con todo activo, acá con Internet desactivada. El monto de julio queda tachado suave como referencia." |
| 03 | Alta rápida — la pantalla más usada | Carga de gasto: monto 52px, chips de medio de pago, card contextual de ciclo + cuotas, grilla de categorías, teclado numérico propio. | "Con tarjeta seleccionada aparecen ciclo y cuotas; con otro medio, desaparecen. Sin categoría, el botón pasa a \"Guardar sin categoría\" y el gasto va a la bandeja." |
| 04 | Resumen — el tab de apertura | Home: saludo, card de disponible tocable, sección "Para atender" (3 avisos), "Últimos movimientos" (3 filas). | "Corta a propósito: un número, lo que hay que atender y los últimos movimientos. Nada más." |
| 05 | Movimientos + bandeja de entrada | Historial agrupado por día, búsqueda, filtros, y la card destacada "Bandeja de entrada" con 3 pendientes y chips de categoría inline. | "Categorización en tanda: tocás un ítem de la bandeja y la grilla se abre inline; asignás y pasa al historial sin salir. Los gastos de tarjeta muestran a qué ciclo van." |
| 06 | Tarjeta — la pantalla diferencial argentina | Detalle de Visa Galicia •• 4321: paginador de ciclo, línea de tiempo con hitos estimados punteados, resumen proyectado con desglose, consumos del ciclo. | "Estimado y confirmado se leen distinto a un metro: punteado ámbar contra relleno verde. Si corregís la fecha de cierre, los consumos se reacomodan de ciclo solos." |
| 07 | Cuotas — el sueldo ya comprometido | Vista agregada: hero "Comprometido por mes, ahora $ 339.550", gráfico de 12 meses, 3 compras en cuotas con progreso. | "Responde una sola pregunta: cuánto de los próximos sueldos ya está comprometido, y cuándo se libera." |
| 08 | Patrimonio — el TC siempre visible | Total del hogar en ARS y ≈USD, sparkline anual, selector de TC (MEP/blue/oficial), composición en barras, 7 tenencias con frescura de valuación. | "El TC usado siempre es visible: transparencia antes que magia. Valuaciones de más de 30 días en ámbar, con acción de actualizar en la fila." |
| 08b | Patrimonio, sin tenencias | Estado vacío del tab Patrimonio con CTA "Cargar tenencia" y 3 chips de sugerencia. | — *(único frame sin anotación ↳)* |
| 09 | Hogar — miembros y visibilidad | Gestión del hogar Coghlan: miembros con roles, invitación pendiente con acciones Reenviar/Revocar, CTA de invitación y card de visibilidad Hogar/Personal. | "La invitación pendiente usa el mismo lenguaje punteado ámbar que las fechas estimadas: todavía no es un hecho." |
| 10 | La pantalla 01a exacta, tokens oscuros | Réplica 1:1 de 01a en modo oscuro para validar tokens: mismos datos, solo cambian colores. | "Tokens oscuros: fondo #141312, superficie #1E1C1A, acento #4FA37F, semánticos aclarados. El + central pasa a ícono tinta sobre verde claro." |
| x | Card "FUERA DE ALCANCE, ANOTADO" *(no es pantalla)* | Recuadro final que declara los 4 huecos del export (ver §5). | — |

### Modelo de navegación implícito (detectado por el crítico)

Tres clases de pantalla según el chrome, nunca documentadas en el export pero consistentes:

- **(a) Tabs raíz, con tab bar y avatar:** 01a / 01b / 01c, 04, 05, 08 / 08b (y 10 como réplica de 01a).
- **(b) Modales de flujo, con X de cierre 22px y sticky footer o CTA propio, sin tab bar:** 02 (L428) y 03 (L565).
- **(c) Pantallas pushed, con chevron atrás y SIN tab bar:** 06 (L987), 07 (L1121) y 09 (L1437). El punto de entrada de cada una no está dibujado (06 se infiere desde el aviso de cierre en 04; 09 desde el avatar; 07 no tiene entrada visible).

### 1.0 Encabezado del canvas (no es pantalla)

Canvas fondo `#E9E6DF` (prop `fondo`: papel/blanco/gris; prop `notas` boolean default true controla las anotaciones ↳ vía `sc-if mostrarNotas`). Logo: cuadrado 36px radius 10 `#1E6E52` con ícono sobre `#F7F5F1` + wordmark "Sobres" Rubik 600 25px `#1A1917` + badge "NOMBRE PROVISORIO" (Spline Sans Mono 9.5px, `#6F6A63`, borde `#E4E0D8`, bg `#FFFFFF`). Card de especificación: paleta de 6 swatches 15px con leyenda **"tinta · ok · atención · excedido · info · papel"** = `#1A1917`, `#1E6E52`, `#A66A00`, `#B3402E`, `#3B5BA5`, `#F7F5F1`; tipografías "Rubik 400–700" y "Spline Sans Mono · $ 1.234.567"; muestrario de badges HOGAR, PERSONAL, ESTIMADA, CONFIRMADA, ROLLOVER, CUOTA 4/12.

Estructura común de todos los frames: 390×844px, radius 34px, shadow `0 2px 12px rgba(26,25,23,.06)`; status bar iOS de 47px ("9:41" 600 15px, señal 4 barras, wifi, batería 25×12 al 72%); home indicator 134×5px radius 3 `#1A1917` opacity .85 a 8px del borde; tab bar de 5 posiciones con FAB central de 52px (solo en pantallas clase a).

### 1.1 · 01a — Presupuesto del hogar, julio

De arriba a abajo: status bar → header de mes (chevrons + "julio 2026" 600 17px + avatar "J" 34px) → segmented **Hogar**/Personal sobre pastilla `#ECE8DF` → hero ("Disponible en julio" / "$ 539.200" mono 40px / línea mono 11px "asignado $ 2.860.000 · gastado $ 2.320.800" / barra 4px fill 81% `#1A1917` con marcador verde 2×11px en `left:32%` = el día del mes / "81 % gastado" y "día 10 de 31 · quedan 21 días") → grupos de partidas en cards blancas (Vivienda: Alquiler y Expensas pagadas; Comida: Supermercado y Delivery en ámbar con aviso de proyección, Restaurantes en verde; Ahorro: transferido "a Broker") → tab bar con Presupuesto activo. Estados dibujados: fija pagada (check + barra verde al 40% de opacidad), variable sana, variable en riesgo con línea de proyección ámbar.

### 1.2 · 01b — La misma pantalla, scrolleada

Header condensado con border-bottom `#E4E0D8`: izquierda "julio 2026 · Hogar" 600 14px, derecha "queda $ 539.200" mono 600 12px (sin segmented ni hero). Grupos Ahorro / Salud (Prepaga pagada, Farmacia 31%) / Servicios (Luz con ícono rayo ámbar —único ícono no gris—, barra vacía, "$ 0 de $ 45.000" + "recurrente · vence el 18 jul"; Internet y Celular pagados) / Suscripciones (badge ROLLOVER azul, barra 75%, "arrastrás + $ 13.800 de junio" en `#3B5BA5`). Cierra con el link centrado "Armar presupuesto de agosto →" (único `<a href>` real del documento; entrada a la pantalla 02).

### 1.3 · 01c — Primer uso, sin presupuesto

Header idéntico a 01a (con selector de mes y avatar). Estado vacío centrado (padding 0 44px 90px): círculo 64px `#E7F0EB` con ícono sobre 28px `#1E6E52`; título "Armá tu primer presupuesto" 600 19px; cuerpo 400 13.5px/1.55 max-width 280px: "Asignale un monto a cada partida del mes, como sobres de plata, y mirá cuánto queda a medida que cargás gastos."; CTA "Empezar con julio". Sin chips de sugerencia (a diferencia de 08b). Tab bar visible.

### 1.4 · 02 — Armado del presupuesto (modal)

X de cerrar 22px arriba, título "Presupuesto de agosto" 600 22px + subtítulo "Partimos del de julio". Card "Ajuste general por inflación" con stepper editable "+ 2,5 %" (borde 1.5px `#1A1917`, mono 600 19px, lápiz) y acción alternativa "Copiar sin ajuste". Lista de 8 filas dibujadas con: toggle 38×22, monto de julio **tachado** (`line-through`, mono 400 11px `#9B958B`), monto nuevo editable (mono 600 14px con `border-bottom:1px dashed #C9C4BA`) y delta debajo. La fila "Internet" está **desactivada**: toggle gris, nombre `#9B958B`, subtexto "desactivada este mes · la paga Vale", monto "$ 0" en `#C9C4BA` sin tachado ni dashed. Footer fijo `rgba(255,255,255,.98)`: "Total agosto · 14 partidas activas" / "$ 2.892.550" + CTA "Confirmar presupuesto". Sin tab bar.

### 1.5 · 03 — Alta rápida (modal)

Header en fila: X + "Nuevo gasto" 600 16px + mini segmented Hogar/Personal. Monto protagonista "$ 84.320" mono 500 **52px** (la tipografía más grande del sistema, ls −.03em). Fila scrolleable de chips de medio de pago (Efectivo · Galicia · MP · **Visa •• 4321** seleccionada en tinta · MC •• 8810). Card contextual de tarjeta: "Cae en el ciclo que cierra el 28 jul" + badge ESTIMADA; fila "Cuotas" con stepper 1/3/6/12 ("1" activo). Sección "¿En qué lo gastaste? · opcional": grilla 4 columnas de 8 categorías ("Súper" seleccionada en verde). Teclado numérico 3×4 con tecla "," y borrar. CTA "Listo". Estados spec'd pero no dibujados: la variante "Guardar sin categoría" y la desaparición del bloque ciclo+cuotas con medios que no son tarjeta (solo en la nota ↳).

### 1.6 · 04 — Resumen (tab de apertura)

Saludo "Hola, Juanse" 600 22px + "viernes 10 de julio" + avatar. Card de disponible **tocable** (chevron): "$ 539.200" a 34px con la misma barra 81% + marcador. Sección "Para atender" con 3 cards sueltas (gap 8px, no filas de una card): cierre de Mastercard BBVA con badge CONFIRMADA y chevron; vencimiento de Luz con rayo ámbar y chevron; bandeja con acción textual "Categorizar" (sin chevron: con acción se ejecuta, con chevron se navega). Sección "Últimos movimientos" con 3 filas y badges de ámbito HOGAR/PERSONAL de 8px.

### 1.7 · 05 — Movimientos + bandeja

Título + avatar → barra de búsqueda (placeholder "Buscar comercio o categoría" en `#9B958B`) → fila de filtros: "Cuenta ▾ / Categoría ▾ / Miembro ▾" (chips con chevron, nunca dibujados abiertos) + "Hogar" activo en tinta + "Personal". Card **Bandeja de entrada** destacada con borde cálido `#DCCEB0` (único en el sistema), contador pill "3" sobre `#A66A00`, 3 ítems: Rappi (expandido, con chips de categoría sugerida inline: "Delivery" preseleccionada en verde + "todas →"), Transferencia recibida (ingreso: "+ $ 120.000" en verde con flecha diagonal) y MercadoLibre (colapsado). Historial agrupado: "Hoy" / "Ayer" / "8 jul"; los consumos de tarjeta agregan "· cierra 28 jul" / "· cierra 13 jul" en ámbar. Estado spec'd no dibujado: la grilla de categorización abierta inline (solo la fila de 3 chips).

### 1.8 · 06 — Tarjeta (pushed, sin tab bar)

Header: back + ícono tarjeta + "Visa Galicia •• 4321" 600 17px. Paginador de ciclo: "Ciclo actual · 29 jun – 28 jul" con chevron izquierdo habilitado y derecho **deshabilitado** (`#D8D4CB` — no se puede avanzar más allá del ciclo actual, único estado disabled de navegación dibujado). Card de línea de tiempo del ciclo (anatomía completa en §3.23): progreso 29%, nodo "hoy" sólido, hitos de cierre y vencimiento **punteados ámbar** (estimados) con acciones "confirmar fecha". Card "Resumen proyectado" + ESTIMADA: "$ 840.450" a 30px, desglose Consumos $ 486.200 / Cuotas $ 296.250 / Impuestos $ 58.000 (con lápiz, editable), y bloque "Conciliar resumen" con subtexto "Cuando llegue el real, cargá el total y vemos la diferencia." Sección "Consumos del ciclo · 18" con 5 visibles (2 con badge CUOTA) y footer "Ver los 18 consumos →".

### 1.9 · 07 — Cuotas (pushed, sin tab bar)

Header: back + "Cuotas activas". Hero: "Comprometido por mes, ahora" / "$ 339.550" a 40px / "3 compras en cuotas · Visa y Mastercard". Card "Próximos 12 meses" con la regla de 3 niveles (§3.25): ago pleno a 64px, sep–feb al 75% de opacidad y 17px, mar–jul stubs de 3px; pie "ago $ 339.550 · desde sep $ 86.250" + "en marzo quedás libre" en verde. Card "Compras en cuotas": 3 filas con badge CUOTA x/N, barra de progreso (= cuotas pagadas) y "$ X/mes · tarjeta" / "termina …".

### 1.10 · 08 — Patrimonio

Título + avatar. Hero doble columna: "Total del hogar" / "$ 47.400.000" a 28px (`white-space:nowrap`) / "≈ USD 32.200"; a la derecha sparkline SVG 108×40 con caption "ago 25 — jul 26". Selector de TC: chips MEP (activo, tinta) / blue / oficial + leyenda "MEP $ 1.470 · hoy 10 jul". Card "Composición": 7 barras horizontales 6px **normalizadas al máximo, no al 100%** (§3.28). Card "Tenencias": 7 filas con vocabulario de frescura ("al TC de hoy", "valuado hoy", "hace 3 días", y la vencida "valuación de hace 39 días" en ámbar con "· actualizar"). Tab bar con Patrimonio activo.

### 1.11 · 08b — Patrimonio, sin tenencias

Estado vacío: círculo verde suave con ícono de gráfico, "Cargá tu primera tenencia", cuerpo "Anotá lo que tienen y actualizá la valuación cuando quieras. El total sale solo.", CTA "Cargar tenencia" **+ fila de 3 chips de sugerencia** ("Dólar billete", "Plazo fijo", "FCI") — asimetría con 01c, que no lleva chips. Tab bar visible. Único frame sin anotación ↳.

### 1.12 · 09 — Hogar (pushed, sin tab bar)

Header: back + "Hogar" 600 17px. Card de miembros: header "Coghlan" + "2 miembros · 1 invitación pendiente"; filas Juanse (avatar tinta, "vos", badge ADMINISTRADOR), Vale (avatar `#6F6A63`, "adulta del hogar", MIEMBRO) y la invitación pendiente: avatar "S" **punteado** (borde 1.5px dashed `#C89A4D`, bg `#FBF6EC`, letra ámbar), "sofi.rios@gmail.com" / "invitada hace 5 días · sin responder", badge PENDIENTE, y debajo (padding-left 48px) las acciones "Reenviar" (verde) y **"Revocar" (`#B3402E`, único uso del rojo en pantalla)**. CTA "Invitar al hogar" con caption "Por email. La persona elige su clave al entrar." Card de visibilidad con candado: "Lo personal es tuyo. Lo compartido lo ven los adultos del hogar." + badge HOGAR ("presupuesto y movimientos compartidos: los ven Juanse y Vale") y badge PERSONAL ("tus partidas privadas: solo las ves vos").

### 1.13 · 10 — Modo oscuro (réplica de 01a)

Mismos datos y estructura que 01a; cambian solo colores: fondo `#141312`, superficie `#1E1C1A`, borde card `#34302B`, divisores `#2A2724`, track `#2E2B26`, texto `#F2EFE9`, secundario `#A39D93`, verde → `#4FA37F`, ámbar → `#C6913B`. Cards **sin sombra** (solo borde). Avatar invertido (bg `#F2EFE9`, "J" en `#141312`). FAB `#4FA37F` con ícono + stroke `#141312` (tinta sobre verde claro, invertido respecto del claro). Opacidad de barra pagada .45 (vs .4 en claro). Solo valida los tokens que aparecen en 01a: chips semánticos, azul info, rojo, bandeja, teclado, estados vacíos, etc. quedan sin mapping oscuro (ver §6).

---

## 2. Tokens

### 2.1 Colores

Los 6 roles semánticos declarados por la leyenda del canvas: **"tinta · ok · atención · excedido · info · papel"**.

#### Modo claro — base y semánticos

| Hex | Nombre propuesto | Rol / usos | Modo |
|---|---|---|---|
| `#1A1917` | tinta | Protagonista (311 usos): texto principal, íconos de status bar, relleno de barras (mes, cuotas, composición), chips seleccionados oscuros (Visa •• 4321, filtro Hogar, MEP, cuota "1", stepper), avatar J, home indicator (.85), barras del gráfico 12 meses. Base de todas las sombras `rgba(26,25,23,…)`. | claro |
| `#6F6A63` | tinta-secundaria | Segundo más usado (274): texto secundario (labels, metadata "Supermercado · Visa •• 4321", metas "$ X de $ Y"), stroke de íconos 18–21px, tab bar inactivo, chips HOGAR/PERSONAL y CUOTA, avatar V, notas ↳. | claro |
| `#9B958B` | tinta-terciaria | Placeholder de búsqueda, montos tachados "jul $ 780.000", partida desactivada, "al TC de hoy"/"valuado hoy"/"hace 3 días", "29 jun", caption sparkline. Vecino de `#A39D93` (oscuro). | claro |
| `#C9C4BA` | tinta-muda | Chevrones apagados de filas, subrayado editable `border-bottom:1px dashed`, monto deshabilitado "$ 0". | claro |
| `#1E6E52` | verde-marca (ok) | FAB, tab activo, CTAs sólidos, links/acciones ("Categorizar", "Reenviar", "confirmar fecha", "Conciliar resumen", "Ver los 18 consumos →"), estados "pagado/transferido" + check, barras sanas, marcador de día, toggle ON, chip categoría seleccionada (borde 1.5px), chip CONFIRMADA, ingreso "+ $ 120.000", "en marzo quedás libre", logo, color de `<a>`. | claro |
| `#17553F` | verde-marca-hover | `a:hover` del documento (L18) — verde marca oscurecido. Único estado hover dibujado. | claro |
| `#A66A00` | ambar-atencion | Barras en riesgo (52%, 79%), avisos "a este ritmo terminás $ 31.200 arriba", texto de chip ESTIMADA/PENDIENTE, "vence el 18 jul", "cierra 28 jul", ícono rayo de Luz, fondo del contador de bandeja, montos ámbar ("$ 18.700", "$ 3.000.000" plazo fijo), "valuación de hace 39 días", borde dashed de hitos estimados del ciclo. | claro |
| `#B3402E` | rojo-excedido | Semántico destructivo/excedido. **SÍ se usa en pantalla** (corrección del crítico): la acción destructiva "Revocar" en 09 (L1475) + swatch de la leyenda. Lo que nunca se demuestra es el estado "excedido" de una partida (ninguna barra ni monto en rojo). | claro |
| `#3B5BA5` | azul-info | Chip ROLLOVER (texto), "arrastrás + $ 13.800 de junio", swatch del canvas. | claro |
| `#F7F5F1` | papel | Fondo de pantalla de los frames claros; texto sobre superficies tinta (avatar, chips seleccionados); fondo del stepper de inflación; knob del dot "hoy" del timeline; stroke del sobre del logo. | claro |
| `#FFFFFF` | superficie-card | Fondo de cards, chips no seleccionados, teclas del numpad, thumb del segmented, knob del toggle, texto de CTAs verdes y del contador de bandeja. | claro |

#### Modo claro — neutros de soporte (rampa arena)

| Hex | Nombre propuesto | Rol / usos | Decisión |
|---|---|---|---|
| `#E4E0D8` | borde-card | Borde 1px de todas las cards, chips inactivos, border-top de tab bar y footers sticky. | conservar |
| `#F0EDE6` | separador-fila | Hairline 1px entre filas de cards (41 usos). | **NEAR-DUPLICATE de `#F0EDE5` — unificar** |
| `#F0EDE5` | pista-progreso | Track vacío de barras 4px (partidas) y 6px (composición), 24 usos. Difiere 1 en canal azul del anterior. | **unificar con `#F0EDE6`** (el modo oscuro usa UN solo `#2E2B26` para ambos roles: evidencia de que la dupla clara es accidental) |
| `#F1EEE8` | fondo-chip-cuota | Fondo del chip CUOTA x/N (6 usos). | **near-duplicate de la familia F0EDE5/6 — unificar o tokenizar aparte** |
| `#E7E3DA` | pista-mes-hero | Track de la barra del mes en 01a (L99) — 1 solo uso. | **inconsistencia: la misma barra en 04 usa `#F0EDE5` — unificar** |
| `#EDEAE2` | pista-timeline | Track 3px del timeline de ciclo (L998) — 1 solo uso. | **tercer gris-pista para el mismo rol — unificar** |
| `#D9D5CB` | borde-marco | Borde 1px del frame de teléfono (12 usos; artefacto del canvas). | **near-duplicate de `#D8D4CB`/`#DDD9CF` — unificar** |
| `#D8D4CB` | toggle-apagado | Track del toggle OFF y chevron deshabilitado del paginador de ciclo. | unificar con vecinos |
| `#DDD9CF` | barra-futura | Barras de 3px de meses sin cuotas (gráfico 12 meses). | unificar con vecinos |
| `#ECE8DF` | fondo-segmented | Track del segmented Hogar/Personal. | conservar |
| `#DCCEB0` | borde-bandeja | Borde de la card "Bandeja de entrada" (L832) — único borde cálido del sistema, hex huérfano (no está en la leyenda). | conservar y tokenizar |

#### Modo claro — fondos suaves de estado

| Hex | Nombre propuesto | Rol / usos | Decisión |
|---|---|---|---|
| `#FBF6EC` | fondo-estimada | Fondo crema del chip ESTIMADA/PENDIENTE, dots estimados del timeline, avatar de invitación pendiente. | conservar |
| `#C89A4D` | borde-estimada | Borde dashed (1px chips, 1.5px avatar) del lenguaje "todavía no es un hecho". | conservar |
| `#E7F0EB` | fondo-verde-suave | Círculo 64px de estados vacíos y fondo del chip CONFIRMADA. | **NEAR-DUPLICATE de `#EDF3EF` — unificar en un solo verde-suave** |
| `#EDF3EF` | fondo-verde-seleccion | Fondo del chip/tile de categoría seleccionada (borde 1.5px `#1E6E52`). | **unificar con `#E7F0EB`** |
| `#EAEEF7` | fondo-azul-suave | Fondo del chip ROLLOVER. | conservar |
| `#D9E8E1` | seleccion-texto | `::selection` del documento (L19). | conservar (estado global) |

#### Modo oscuro (pantalla 10)

| Hex | Nombre propuesto | Rol / usos |
|---|---|---|
| `#141312` | fondo-oscuro | Fondo de pantalla; texto del avatar invertido; stroke del + del FAB oscuro. |
| `#1E1C1A` | superficie-oscuro | Fondo de cards; base del tab bar `rgba(30,28,26,.97)`. |
| `#34302B` | borde-card-oscuro | Borde de cards y border-top del tab bar. |
| `#2A2724` | separador-fila-oscuro | Hairline entre filas. |
| `#2E2B26` | pista-progreso-oscuro | Track único de barras (colapsa la dupla clara). |
| `#F2EFE9` | tinta-oscuro | Texto principal; relleno de barra del mes; avatar invertido; home indicator; status bar. |
| `#A39D93` | tinta-secundaria-oscuro | Texto secundario e íconos. Vecino de `#9B958B` (claro) — coherentes entre modos, revisar si conviven. |
| `#4FA37F` | verde-marca-oscuro | Acento aclarado: FAB (ícono stroke `#141312`), tab activo, "pagado/transferido", marcador de día, barras sanas (.45 pagadas), sombra FAB `rgba(79,163,127,.25)`. |
| `#C6913B` | ambar-atencion-oscuro | Barras en riesgo, avisos "a este ritmo…", monto "$ 18.700". |
| `#242220` | fondo-segmented-oscuro | Track del segmented. |
| `#38342F` | segmented-activo-oscuro | Thumb activo (sin sombra, a diferencia del claro). |
| `#3A3733` | borde-marco-oscuro | Borde del frame de teléfono oscuro. |

#### Fondos de canvas (del export, NO de la app)

| Hex | Nombre | Rol |
|---|---|---|
| `#E9E6DF` | fondo-canvas-papel | Fondo del canvas del documento (default de la prop `fondo`). |
| `#F4F2EE` | fondo-canvas-blanco | Opción "blanco" de la prop. |
| `#DEDCD6` | fondo-canvas-gris | Opción "gris" de la prop. |

### 2.2 Tipografía

**Familias.** Rubik variable 400..700 vía Google Fonts (fallback `system-ui, sans-serif`; `-webkit-font-smoothing:antialiased` en body). Pesos usados: 400 cuerpo/metadata, 500 títulos de fila/labels/links, 600 títulos/CTAs/chips/montos destacados; 700 cargado pero no usado. **Spline Sans Mono** variable 400..700 (fallback `monospace`) para **toda** cifra.

**La convención dura del sistema, no enunciada en el export pero cumplida sin excepción: número = mono, palabra = Rubik.** Montos, porcentajes, decimales, fechas numéricas del timeline, chips CUOTA n/m y teclas del numpad van en Spline Sans Mono; todo lo demás en Rubik.

**Font-feature:** no hay NINGÚN `font-feature-settings` en el archivo (verificado con grep) — no se declara `tabular-nums`; el alineado de cifras lo garantiza la familia mono en sí.

| Uso | Familia / peso | Tamaño | LH / LS | Ejemplos |
|---|---|---|---|---|
| Cifra hero alta rápida | Mono 500 | 52px | ls −.03em | "$ 84.320" (03, único uso) |
| Cifra hero disponible/comprometido | Mono 500 | 40px | ls −.02em | "$ 539.200" (01a), "$ 339.550" (07) |
| Cifra card resumen | Mono 500 | 34px | ls −.02em | "$ 539.200" (04) |
| Cifra resumen proyectado | Mono 500 | 30px | ls −.02em | "$ 840.450" (06) |
| Cifra total patrimonio | Mono 500 | 28px | ls −.02em, `nowrap` | "$ 47.400.000" (08) |
| Título raíz de tab | Rubik 600 | 22px | — | "Hola, Juanse", "Movimientos", "Patrimonio", "Presupuesto de agosto" |
| Título con back/ícono | Rubik 600 | 17px | — | "julio 2026", "Visa Galicia •• 4321", "Cuotas activas", "Hogar" |
| Título modal compacto | Rubik 600 | 16px | — | "Nuevo gasto", "Coghlan" |
| Header condensado (scroll) | Rubik 600 / Mono 600 | 14px / 12px | — | "julio 2026 · Hogar" / "queda $ 539.200" |
| Título empty state | Rubik 600 | 19px | — | "Armá tu primer presupuesto" |
| Cuerpo empty state | Rubik 400 | 13.5px | /1.55, max-w 280px | — |
| CTA | Rubik 600 | 15px / 14.5px | — | full-width (padding 15px 0) / empty-hug e "Invitar al hogar" (14px 30px o 14px 0) |
| Hora status bar | Rubik 600 | 15px | — | "9:41" |
| Título de fila | Rubik 500 | 14px (13.5 en tenencias/avisos; 13.5 **600** títulos de card) | — | "Alquiler", "Coto", "Bandeja de entrada" |
| Monto de fila | Mono 600 | 13px (12.5 tenencias; 12.5 **500** desgloses; 14 editable en 02) | — | "$ 84.320"; delta 400 10.5px; tachado 400 11px `line-through` |
| Metadata de fila | Rubik 400 / Mono 400 | 11px | — | "Supermercado · Visa •• 4321 · cierra 28 jul" / "$ 268.400 de $ 520.000" |
| Estados y links inline | Rubik 500 | 12.5px (11px acciones chicas; 10.5px "· actualizar") | — | "pagado", "Categorizar", "Revocar", "confirmar fecha" |
| Header de sección | Rubik 600 | 12px `#6F6A63` | margen ~12-14px 2px 5-7px | "Vivienda", "Hoy", "Para atender", "Tenencias" |
| Labels de card | Rubik 500 | 12px `#6F6A63` | — | "Disponible en julio", "Composición" |
| Progreso bajo barra | Mono 400/500 | 10.5px | — | "81 % gastado" / "día 10 de 31 · quedan 21 días" / "MEP $ 1.470 · hoy 10 jul" |
| Chips de selección | Rubik 500 (600 activo) | 12.5 / 12 / 11.5 / 11px según escala | — | ver §3.3 |
| Badges (chips de estado) | Rubik 600 (mono 600 en CUOTA) | 8.5px (8px bajo montos; 9px leyenda) | ls .08em (.05em CUOTA) | ESTIMADA, HOGAR, CUOTA 4/12 |
| Tab bar | Rubik 500/600 | 10px | — | íconos 21px stroke 1.5/1.8, gap 3px |
| Grid de categorías | Rubik 500 (600 activa) | 10px | — | ícono 18px, tile radius 12 |
| Numpad | Mono 500 | 22px | — | teclas 50px; cuotas mono 13px; stepper inflación mono 600 19px |
| Micro-labels de gráficos | Mono 400 | 9 / 9.5 / 10px (+600 10.5px "hoy") | — | eje de meses, caption sparkline, timeline; "≈ USD 32.200" mono 500 14px |
| Notas de spec (canvas) | Rubik 400 | 11.5px | /1.5, max-w 390px | footnotes ↳ |

**Line-heights explícitos** solo en texto multilínea: /1.45 (nota inflación), /1.5 (footnotes, card candado 09), /1.55 (cuerpo empty states), /1.65 (card fuera-de-alcance). Todo lo demás, line-height normal implícito.

**Letter-spacing (inventario completo):** .08em (chips 8–9px, 24 usos), .05em (labels mono del canvas + chips CUOTA, 19), .06em (headers de sección del canvas, 7), .07em (badge NOMBRE PROVISORIO, 1), .03em (caption de leyenda, 1), −.01em (logo, 1), −.02em (cifras 28–40px, 6), −.03em (cifra 52px, 1).

### 2.3 Radios, sombras, hairlines y punteados

**Radios** (regla: contenedor ≈ contenido + padding — segmented 11/9, mini-segmented 9/7, toggle 11/9):

| Radio | Uso |
|---|---|
| 34px | frame de teléfono 390×844 (13 usos) |
| 32 / 26 / 18 / 17 / 10px | círculos (mitad del lado): ícono empty 64px, FAB 52px, avatar 36px, avatar 34px, contador 20px |
| 14px | card estándar (32 usos) |
| 12px | CTAs full-width, tiles de categoría, buscador, card ciclo/cuotas |
| 11px | track del segmented; track del toggle 38×22 |
| 10px | chips de medio de pago, teclas del numpad, stepper de inflación, logo |
| 9px | thumb del segmented, botones de cuota 44px, chips de filtro, chips de sugerencia 08b, knob del toggle |
| 8px | chips de categoría en bandeja, chips de TC, swatches |
| 7px | thumb del mini-segmented; dots del timeline 13–14px |
| 4px | badges de texto, batería, dot inicial del timeline 7px |
| 3px | home indicator; barras de composición 6px; `3px 3px 0 0` tope de barras del gráfico 12 meses |
| 2px | barras de progreso 4px y sus rellenos; barra interna de la batería |
| 1px | barras de señal, marcador de día 2×11px |

**Sombras** (todas base tinta salvo el FAB):

| Sombra | Uso |
|---|---|
| `0 1px 2px rgba(26,25,23,.04)` | card estándar claro (29 usos). Las cards oscuras **no llevan sombra**, solo borde. |
| `0 1px 2px rgba(26,25,23,.08)` | thumb activo del segmented |
| `0 2px 12px rgba(26,25,23,.06)` | frame de teléfono claro |
| `0 2px 12px rgba(26,25,23,.2)` | frame de teléfono oscuro |
| `0 6px 14px rgba(30,110,82,.3)` | FAB claro (sombra coloreada con el verde marca) |
| `0 6px 14px rgba(79,163,127,.25)` | FAB oscuro |

**Hairlines:** separador de fila `1px solid #F0EDE6` (claro) / `#2A2724` (oscuro); borde de card `#E4E0D8` / `#34302B`; border-top de tab bar y footers sticky ídem.

**Punteados** — el lenguaje "todavía no es un hecho" (nota L1505): chip ESTIMADA/PENDIENTE `1px dashed #C89A4D` sobre `#FBF6EC`; dots estimados del timeline `1.5px dashed #A66A00`; avatar de invitación `1.5px dashed #C89A4D`; monto editable `border-bottom 1px dashed #C9C4BA`.

**Bordes de selección:** `1.5px solid #1E6E52` (categoría activa) y `1.5px solid #1A1917` (stepper de inflación); todo lo demás 1px.

**Transparencias funcionales:** tab bar `rgba(255,255,255,.97)` / `rgba(30,28,26,.97)`; footer sticky `rgba(255,255,255,.98)`; contorno de batería `rgba(26,25,23,.4)` / `rgba(242,239,233,.4)`. **Opacidades:** .85 home indicator; **.4 relleno de barra pagada al 100%** en claro / **.45** en oscuro ("una fija pagada al 100 % se ve calma"); .75 barras de meses futuros con cuota.

**Transiciones/animaciones:** ninguna declarada (mockup estático, cero `transition`/`animation`).

### 2.4 Espaciados y medidas repetidas

- **Gutter horizontal de pantalla: 20px constante** (`padding:0 20px` / `margin:X 20px 0`). Headers de sección de lista a 22px (compensación óptica +2px sobre la card).
- **Padding de fila de card:** 11px 14px (estándar, 01a/04), 10px 14px (compacta, listas largas 01b/05/06), 12px 14px (cuotas/avisos 07), 9px 14px (bandeja), 12px 16px (miembros 09).
- **Padding de card contenedora:** 13px 14px, 14px 16px, 15px 16px (hero resumen), 18px 18px 14px (timeline de ciclo).
- **Gaps dominantes:** 10px ícono-texto en partida, 11px ícono-texto en movimiento, 3px ícono-label del tab bar, 5–6px columna interna de fila (título→barra→meta), 7px grillas (chips/numpad/categorías), 8px cards apiladas de "Para atender", 12px avatar-texto en 09.
- **Márgenes verticales:** card tras header 12–16px; título de sección `12-14px 2px 5-7px`; metadata `margin-top 2-3px`; barra del mes `margin-top 12-13px`; leyenda bajo barra `margin-top 6px`.
- **Alturas y medidas fijas:** status bar 47px (padding `12px 27px 0 31px`); frame 390×844; tab bar padding `9px 10px 24px`, grid de 5 columnas iguales, íconos 21px; **FAB 52px con `margin-top:-24px`** sobresaliendo; home indicator 134×5px a `bottom:8px`; teclas del numpad 50px; botón de cuota 44px de ancho; toggle 38×22 (knob 18); avatares 34px (header) y 36px (listas); círculo de empty 64px; gráfico de cuotas 74px (barras 64/17/3px); sparkline 108×40; barras de progreso 4px (partidas), 6px (composición), 3px (timeline); marcador de día 2×11px con `top:-3.5px`; batería 25×12.
- **Safe areas:** padding-bottom 24px del tab bar, 30px del footer sticky y 90px de los empty states reservan la zona del home indicator. Footer sticky de 02: `12px 20px 30px`.
- **Empty states:** padding `0 44px 90px`; ícono→título 20px, título→cuerpo 10px, cuerpo→CTA 24px, CTA→chips 16px.
- **Íconos:** sistema Lucide inline SVG (viewBox 24×24), stroke-width 1.5 (default), 1.8 (tab activo), 2 (status bar, check, FAB); tamaños renderizados 12/13/14/15/16/17/18/19/20/21/22/24/26/28px.
- **Canvas (no producto):** gap 64px entre secciones, 36px entre frames, 16px título-fila, 10px label-frame.

### 2.5 Convención de formato numérico

Sistema completo, consistente en todo el export y no enunciado en ninguna nota:

| Regla | Formato | Ejemplo |
|---|---|---|
| Pesos | `"$ "` + miles con punto, sin decimales | `$ 1.234.567`, `$ 84.320` |
| Decimales | coma (tecla "," en el numpad) | `+ 2,5 %` |
| Porcentajes | espacio antes del `%` | `81 %`, `29 %` |
| Dólares | prefijo `USD ` sin símbolo | `USD 9.500` |
| Aproximación | `≈` antepuesto | `≈ USD 32.200` |
| Periodicidad | sufijo `/mes` | `$ 86.250/mes` |
| Ingresos | `+ $` en verde | `+ $ 120.000` |
| Tarjetas | `•• ` + últimos 4 | `Visa •• 4321` |
| Separador de metadata | ` · ` (punto medio con espacios) | `Supermercado · Visa •• 4321 · cierra 28 jul` |
| Rangos de fecha | en-dash con espacios en 06 (`29 jun – 28 jul`) pero em-dash en el sparkline (`ago 25 — jul 26`) | inconsistencia, ver §6 |

Toda cifra en Spline Sans Mono; toda palabra en Rubik.

---

## 3. Componentes repetidos

### 3.1 Badge / tag de estado (mayúsculas)

**Anatomía base:** span inline, Rubik 600, letter-spacing .08em, radius 4px, MAYÚSCULAS. Tres escalas: 9px padding `2px 6px` (leyenda del canvas), 8.5px `2px 5px` (inline en cards), 8px `1.5px 4px` (colgado bajo el monto en filas de movimiento, `display:inline-block; margin-top:3px`).

**Variantes cromáticas exactas:**

| Variante | Texto | Borde | Fondo |
|---|---|---|---|
| NEUTRAL-OUTLINE (HOGAR, PERSONAL, ADMINISTRADOR, MIEMBRO) | `#6F6A63` | `1px solid #E4E0D8` | `#FFFFFF` (o sin bg en roles) |
| ESTIMADA / PENDIENTE | `#A66A00` | `1px dashed #C89A4D` | `#FBF6EC` |
| CONFIRMADA | `#1E6E52` | transparente | `#E7F0EB` |
| ROLLOVER | `#3B5BA5` | sin borde | `#EAEEF7` |
| CUOTA x/N (**la única en mono**) | `#6F6A63`, Spline Sans Mono 600 8.5px, ls **.05em** | sin borde | `#F1EEE8` |

Contenidos que aparecen: HOGAR, PERSONAL, ESTIMADA, CONFIRMADA, ROLLOVER, CUOTA 4/12, CUOTA 5/6, CUOTA 2/3, PENDIENTE, ADMINISTRADOR, MIEMBRO (+ "NOMBRE PROVISORIO" en el canvas: mono 600 9.5px ls .07em, no es UI de app). Semántica consistente: **punteado ámbar = "todavía no es un hecho"** (ESTIMADA y PENDIENTE comparten tratamiento exacto), verde relleno = confirmado, azul = rollover, mono gris = cuota. Apariciones: 01b (ROLLOVER), 03 (ESTIMADA), 04 (CONFIRMADA + ámbito 8px), 05 (ámbito 8px), 06 (ESTIMADA ×3, CUOTA ×2), 07 (CUOTA ×3), 09 (ADMINISTRADOR, MIEMBRO, PENDIENTE, HOGAR/PERSONAL 8.5px). No aparece en 10 (esa pantalla no tiene partidas con badge) → sin mapping oscuro.

### 3.2 Barra de avance

**Anatomía:** contenedor 4px de alto, radius 2px, `overflow:hidden`; fill 100% de alto, radius 2px. Track claro `#F0EDE5` en cards (`#E7E3DA` en el hero de 01a, inconsistencia). **El color del fill sale de la proyección, no del % gastado** (nota de 01a): `#1A1917` tinta para la barra global del mes (81%) y las cuotas; `#1E6E52` verde ok (38%, 31%, 75%); `#A66A00` ámbar atención (52%, 79%); fijas pagadas al 100%: fill verde con `opacity:.4`. **Variante con marcador de día:** div absoluto `left:32%`, `top:-3.5px`, 2×11px, `#1E6E52`, radius 1px. Variantes: (1) barra del mes con tick, (2) partida variable verde/ámbar, (3) fija pagada "calma", (4) barra vacía (Luz, track sin fill), (5) barra de cuota en tinta (33/83/67%), (6) composición gruesa 6px radius 3 (08). Oscuro: track `#2E2B26`; fills `#F2EFE9` / `#4FA37F` (.45 pagadas) / `#C6913B`.

### 3.3 Chip / píldora seleccionable

**Patrón común:** borde `1px solid #E4E0D8`, bg `#FFFFFF`, Rubik 500, `#1A1917`, `flex:none`. Seleccionado: invierte a bg `#1A1917`, texto `#F7F5F1` 600 (selección de datos = tinta) — o borde `1.5px #1E6E52` + bg `#EDF3EF` texto verde 600 (sugerencia inteligente aceptable = verde). Cinco escalas:

| Variante | Radius | Padding | Font | Detalle |
|---|---|---|---|---|
| **Medio de pago** (03) | 10px | 10px 12px | 12.5px | fila scrolleable `nowrap/overflow:hidden`, gap 7px; "Visa •• 4321" seleccionada con ícono tarjeta 14px blanco; "MC •• 8810" con ícono gris |
| **Filtro con chevron** (05) | 9px | 6px 10px | 11.5px | "Cuenta ▾ / Categoría ▾ / Miembro ▾" con chevron-down 12px `#6F6A63`; "Hogar" activo en tinta; dropdowns nunca dibujados abiertos |
| **Categoría en bandeja** (05) | 8px | 5px 9px | 11px | sugerida activa en verde con ícono 13px; **"todas →"** variante navegacional en gris `#6F6A63` |
| **Selector de TC** (08) | 8px | 5px 11px | 11.5px | MEP activo tinta / blue / oficial; leyenda al lado "MEP $ 1.470 · hoy 10 jul" mono 10.5px |
| **Sugerencia en vacío** (08b) | 9px | 7px 12px | 12px | "Dólar billete / Plazo fijo / FCI" — componente "chips de arranque" solo presente en 08b (01c no los tiene) |

### 3.4 Card contenedora (superficie base)

El átomo de superficie: bg `#FFFFFF`, borde `1px solid #E4E0D8`, radius 14px, sombra `0 1px 2px rgba(26,25,23,.04)`; filas internas separadas con `border-top 1px solid #F0EDE6`. Variantes: radius 12 (buscador, card ciclo/cuotas de 03), **borde ámbar `#DCCEB0`** (solo la Bandeja de entrada), oscuro `#1E1C1A`/`#34302B` sin sombra. Presente en todas las pantallas con contenido.

### 3.5 Card de partida (fila de sobre presupuestario)

Fila en card blanca, padding 11px 14px (10px 14px en 01b), columna con gap 6px (5px en 01b). **Línea 1:** ícono 18px stroke `#6F6A63` 1.5 (o `#A66A00` si hay aviso activo — Luz) + nombre 500 14px + derecha: (a) variable → "queda" 400 11px `#6F6A63` + monto mono 600 13px en `#1A1917` (sano) o `#A66A00` (riesgo); (b) fija cumplida → check 14px stroke `#1E6E52` w2 + estado 500 12.5px verde ("pagado"/"transferido"). **Línea 2:** barra 4px. **Línea 3:** meta mono 400 11px `#6F6A63` `"$ 268.400 de $ 520.000"` con sufijos `· fijo`, `· a Broker`; o fila doble con dato a la derecha ("recurrente · vence el 18 jul" ámbar / "arrastrás + $ 13.800 de junio" azul). **Línea 4 opcional:** proyección 400 11px `#A66A00` "a este ritmo terminás $ 31.200 arriba". 6 variantes: fija pagada, variable sana, variable en riesgo, sin gasto con vencimiento (Luz), con ROLLOVER, dark.

### 3.6 Léxico de estados de partida (sistematizado por el crítico)

Vocabulario cerrado que la implementación debe respetar textual:

| Estado / sufijo | Texto verbatim | Color |
|---|---|---|
| Pagada | "pagado" | `#1E6E52` + check |
| Transferida | "transferido" | `#1E6E52` + check |
| Variable | "queda" + monto | gris + monto tinta o ámbar |
| Fija | sufijo "· fijo" | gris |
| Destino | sufijo "· a Broker" | gris |
| Recurrente por vencer | "recurrente · vence el 18 jul" | `#A66A00` |
| Proyección en riesgo | "a este ritmo terminás $ 31.200 arriba" | `#A66A00` |
| Rollover | "arrastrás + $ 13.800 de junio" | `#3B5BA5` |
| Desactivada (02) | "desactivada este mes · la paga Vale" | `#9B958B` |

Refinamiento del crítico sobre la regla del ícono ámbar: el único ícono ámbar de 01b es Luz — la partida con aviso activo y $ 0 gastado; coherente con el rayo ámbar de "Vence Luz" en 04. Regla implícita: **ícono ámbar = partida con aviso activo (vencimiento)**, no "en riesgo".

### 3.7 Fila de movimiento

Padding 11px 14px (04) / 10px 14px (05, 06), flex gap 11px, separador `#F0EDE6`. Ícono de categoría 18px `#6F6A63`. Centro `min-width:0`: comercio 500 14px; meta 400 11px `#6F6A63` formato "Categoría · medio"; consumo de tarjeta agrega "· cierra 28 jul" con span en `#A66A00`. Derecha `text-align:right`: monto mono 600 13px; **variante ingreso:** "+ $ 120.000" en `#1E6E52` con ícono flecha diagonal 17px verde — única representación de dinero entrante del documento; debajo badge HOGAR/PERSONAL 8px. Variante 06 (consumos de ciclo): sin ícono ni badge, meta con fecha primero ("hoy · Supermercado", "1 jul · Hogar"), cuotas con badge CUOTA inline junto al nombre. Agrupación temporal: headers "Hoy" / "Ayer" / "8 jul". Pie expandible: "Ver los 18 consumos →" 500 12.5px verde centrado con border-top.

### 3.8 Bandeja de entrada + contador

Card con borde diferencial `#DCCEB0`. Header: ícono inbox 16px stroke `#A66A00` + "Bandeja de entrada" 600 13.5px + **contador pill**: min-width 20px, alto 20px, radius 10px, bg `#A66A00`, texto blanco mono 600 11px, padding 0 6px ("3") — única pill numérica del sistema. Ítem expandido (Rappi): fila de movimiento sin ícono + fila de chips de categoría inline (gap 6px, margin-top 8px). Ítems colapsados: filas normales. Eco en 04 como aviso "3 movimientos sin categorizar" + acción "Categorizar". Comportamiento spec'd (nota de 05): grilla se abre inline, asignás y pasa al historial sin salir — el estado abierto nunca se dibujó.

### 3.9 Tab bar + FAB

`position:absolute` bottom, bg `rgba(255,255,255,.97)`, border-top `#E4E0D8`, padding `9px 10px 24px`, grid 5 columnas iguales. Ítem: columna centrada gap 3px, ícono 21px, inactivo stroke `#6F6A63` w1.5 + label 500 10px; activo stroke `#1E6E52` w1.8 + label 600 10px. **FAB central: círculo 52px `#1E6E52`, `margin-top:-24px`, sombra `0 6px 14px rgba(30,110,82,.3)`, ícono + 24px stroke blanco w2** (sin label, a diferencia de los otros 4 tabs). Tabs verbatim: Resumen (casa) · Presupuesto (billetera) · [+] · Movimientos (flechas) · Patrimonio (gráfico). Oscuro: bg `rgba(30,28,26,.97)`, borde `#34302B`, inactivo `#A39D93`, activo `#4FA37F`, FAB `#4FA37F` con + stroke `#141312`. Ausente en 02, 03, 06, 07, 09.

### 3.10 Teclado numérico

Solo en 03: grid 3 columnas gap 7px; tecla bg `#FFFFFF`, borde `#E4E0D8`, radius 10px, **50px de alto**, dígito mono 500 22px. Disposición 1–9, tecla "," (coma decimal), 0, tecla borrar (ícono delete 20px stroke 1.5). Arriba, display del monto a 52px; debajo CTA "Listo" (que según la nota muta a "Guardar sin categoría" sin categoría elegida — variante nunca dibujada).

### 3.11 Stepper de cuotas (1 / 3 / 6 / 12)

En 03, dentro de la card de ciclo, separado por border-top `#F0EDE6` + padding-top 9px: label "Cuotas" 400 12px gris `flex:1` + 4 botones de **44px de ancho fijo**, padding 7px 0, radius 9px, mono 13px, gap 8px. Default: borde `#E4E0D8`, bg blanco, 500. Seleccionado ("1"): borde y bg `#1A1917`, texto `#F7F5F1` 600. Todo el bloque ciclo+cuotas aparece solo con tarjeta seleccionada (nota de 03).

### 3.12 Grilla de categorías (picker 4 columnas)

En 03: encabezado "¿En qué lo gastaste? · opcional" 400 12px gris. Grid `1fr×4` gap 7px; celda: borde `#E4E0D8`, bg blanco, radius 12px, padding 9px 2px, columna centrada gap 4px, ícono 18px stroke `#6F6A63` 1.5, label 500 10px. Seleccionada ("Súper"): borde `1.5px #1E6E52`, bg `#EDF3EF`, ícono y label verdes 600. Categorías verbatim: **Súper, Delivery, Restaurantes, Nafta, SUBE, Farmacia, Suscripciones, Regalos**. El mismo lenguaje verde reaparece como chip horizontal en la bandeja de 05: un sistema, dos formas.

### 3.13 Botón primario (CTA verde)

bg `#1E6E52`, texto `#FFFFFF`, Rubik 600, radius 12px. Tres tamaños: (a) hug de empty state: 14.5px, padding 14px 30px ("Empezar con julio", "Cargar tenencia"); (b) full-width de flujo: 15px, padding 15px 0 ("Confirmar presupuesto", "Listo"); (c) full-width con ícono: 14.5px, padding 14px 0, gap 8px, ícono sobre 16px ("Invitar al hogar", con caption "Por email. La persona elige su clave al entrar."). **No hay botón secundario relleno: lo secundario siempre es link de texto verde.**

### 3.14 Acciones / links de texto

Rubik 500, `#1E6E52`, sin subrayado, 10.5–13.5px según densidad: "Armar presupuesto de agosto →" 13.5px, "Copiar sin ajuste" / "Categorizar" / "Reenviar" / "Ver los 18 consumos →" 12.5px, "Conciliar resumen" 13px con ícono refresh 15px, "confirmar fecha" / "en marzo quedás libre" 11px, "· actualizar" 10.5px. **Variante destructiva: "Revocar" 500 12.5px `#B3402E`** (único uso del rojo excedido como acción — corrección del crítico: el rojo SÍ está en pantalla). Variante gris terciaria: "todas →". Estados globales del documento: **hover `a:hover{color:#17553F}`** y **`::selection{background:#D9E8E1}`**. La flecha "→" como sufijo = convención de "lleva a otra vista". Regla implícita: toda acción secundaria/inline es texto verde, nunca botón relleno. No hay pressed/focus/drag dibujados en ningún frame (ausencia a declarar).

### 3.15 Hoja / sticky footer de confirmación

En 02: `position:absolute` bottom, bg `rgba(255,255,255,.98)`, border-top `#E4E0D8`, padding `12px 20px 30px`. Fila de total `justify-space-between align-baseline`: "Total agosto · 14 partidas activas" 400 12px gris vs "$ 2.892.550" mono 600 17px tinta; CTA full-width margin-top 10px. En 03 el bloque no es absolute sino flujo (CTA con margin-bottom 26px bajo el teclado). Reemplaza a la tab bar en pantallas de flujo; comparte receta con ella (blanco translúcido + border-top), opacidad .98 vs .97. El patrón fila label-Rubik-gris / valor-mono-tinta se repite en el desglose de 06 y el pie del gráfico de 07.

### 3.16 Estado vacío (01c vs 08b)

Contenedor `flex:1` columna centrada, padding `0 44px 90px`, centrado. Círculo 64px bg `#E7F0EB` con ícono 26–28px stroke `#1E6E52` (sobre en 01c, gráfico de línea en 08b). Título 600 19px margin-top 20px; cuerpo 400 13.5px/1.55 margin-top 10px max-width 280px; CTA hug margin-top 24px. **Asimetría:** 08b agrega fila de 3 chips de sugerencia margin-top 16px ("Dólar billete / Plazo fijo / FCI"); 01c no lleva chips. Ambos mantienen header y tab bar visibles.

### 3.17 Header de pantalla

Cinco patrones sobre gutter 20px — el patrón elegido codifica el nivel de navegación (las 3 clases de §1):

1. **Raíz de tab con avatar:** título 600 22px + avatar 34px a la derecha; en 04 el título es saludo con subtítulo de fecha.
2. **Selector de mes** (01a/01c/10): chevrons 18px `#6F6A63` + "julio 2026" 600 17px, gap 8px, + avatar. Es el navegador temporal del presupuesto.
3. **Detalle con back** (06/07/09): chevron-left 20px `#1A1917` + título 600 17px `flex:1`; 06 agrega ícono de tarjeta 18px.
4. **Modal con X** (02/03): X 22px; en 02 la X va sola arriba y el título 22px debajo con subtítulo; en 03 es fila compacta X + "Nuevo gasto" 16px + mini segmented.
5. **Condensado de scroll** (01b): padding `8px 20px 9px`, border-bottom `#E4E0D8`, "julio 2026 · Hogar" 600 14px / "queda $ 539.200" mono 600 12px — "mes y disponible siempre a la vista".

Oscuro: título `#F2EFE9`, chevrons `#A39D93`, avatar invertido.

### 3.18 Segmented Hogar/Personal

Track bg `#ECE8DF` radius 11px padding 2px, grid 2 columnas; activo: bg `#FFFFFF` radius 9px padding 8px 0, 600 13px, sombra `.08`; inactivo 500 13px `#6F6A63`. Variante compacta en header de 03: track radius 9, segmentos padding 5px 12px radius 7px, 11.5px. Oscuro: track `#242220`, activo `#38342F` texto `#F2EFE9` **sin sombra**. En 05 el mismo par aparece como **dos chips sueltos** en la fila de filtros (tercera anatomía — inconsistencia, ver §6). Semántica definida en 09: HOGAR = compartido entre adultos, PERSONAL = privado.

### 3.19 Toggle switch (partida on/off)

Solo en 02: pastilla 38×22px radius 11 padding 2px. ON: bg `#1E6E52`, knob a la derecha. OFF: bg `#D8D4CB`, knob a la izquierda. Knob 18px blanco radius 9. Sin borde ni sombra. La fila apagada atenúa todo: nombre `#9B958B`, nota gris, monto "$ 0" en `#C9C4BA` sin subrayado editable.

### 3.20 Fila de armado de presupuesto (toggle + monto editable)

Solo en 02: toggle + centro (nombre 500 14px; debajo monto anterior "jul $ 780.000" mono 400 11px `#9B958B` **tachado** — "tachado suave como referencia") + derecha (monto nuevo mono 600 14px con `border-bottom 1px dashed #C9C4BA` = affordance editable; debajo delta "+ $ 19.500" mono 400 10.5px gris). Encima, la card de control de inflación (§3.21).

### 3.21 Sistema "valor editable" (lápiz + subrayado punteado)

Lenguaje transversal de "esto se puede editar", con dos representaciones (detectado por el crítico como sistema):

- **Subrayado punteado** `1px dashed #C9C4BA` bajo los montos editables de 02.
- **Ícono lápiz** 13px junto a "+ 2,5 %" del ajuste por inflación (02) y 12px junto a "Impuestos y cargos estimados" (06).
- **Caja de control** del ajuste: borde `1.5px solid #1A1917` (borde grueso = control), radius 10px, padding 9px 12px, bg `#F7F5F1`, "+ 2,5 %" mono 600 19px + lápiz; debajo "Copiar sin ajuste" verde separado por divisor.

### 3.22 Card de aviso "Para atender"

Solo en 04: cards sueltas apiladas con gap 8px (no filas de una card), padding 12px 14px, flex gap 11px. Ícono semántico 18px (tarjeta gris, **rayo `#A66A00`** para vencimiento, inbox gris). Título 500 13.5px; meta mono (o Rubik) 400 11.5px margin-top 3px ("proyectado $ 152.700" + badge CONFIRMADA / "$ 45.000 sugerido · recurrente"). Derecha: chevron 16px `#C9C4BA` (**navega**) o acción textual verde "Categorizar" (**ejecuta**).

### 3.23 Línea de tiempo de ciclo de tarjeta (anatomía completa, del crítico)

Solo en 06, card padding `18px 18px 14px`. Pista `position:relative` height 16px:

- Track 3px radius 2 `#EDEAE2`, top 6px, ancho completo.
- Tramo recorrido: width **29%** bg `#1A1917`.
- Punto de inicio: círculo **7px** relleno `#1A1917` en left 0 (= 29 jun).
- Nodo "hoy": círculo **13px** bg `#F7F5F1` con borde `3px solid #1A1917`, en `left:29%` (translateX −6px).
- Nodo cierre: círculo 13px bg `#FBF6EC` borde `1.5px dashed #A66A00`, en `left:72%`.
- Nodo vencimiento: ídem, anclado a `right:0`.
- Labels (fila height 15px, margin-top 4px): "29 jun" mono 400 10px `#9B958B` en left 0; "hoy" mono 600 10.5px `#1A1917` centrado en 29%. **Cierre y vencimiento NO tienen label sobre la línea**: sus fechas viven en el bloque inferior.
- Bloque inferior (border-top `#F0EDE6`, `justify-flex-end` gap 40px): "cierre 28 jul" y "vence 6 ago" mono 400 11px (fecha en 600) + badge ESTIMADA + link "confirmar fecha" 500 11px verde.
- Arriba, paginador: chevrons 16px + "Ciclo actual · 29 jun – 28 jul" 600 13px; chevron derecho **deshabilitado** `#D8D4CB`.

Mismo lenguaje punteado-ámbar que ESTIMADA/PENDIENTE y el avatar de invitación. Ambigüedad de escala en §6.

### 3.24 Card resumen proyectado (desglose label/valor)

En 06: header "Resumen proyectado" 500 12px gris + ESTIMADA; monto mono 500 30px; desglose en filas `justify-space-between` gap 6px: label Rubik 400 12.5px gris vs valor mono 500 12.5px tinta (Consumos $ 486.200 / Cuotas $ 296.250 / Impuestos $ 58.000 con lápiz). Pie con divisor: ícono refresh verde + "Conciliar resumen" 500 13px + "Cuando llegue el real, cargá el total y vemos la diferencia." 400 11px gris.

### 3.25 Gráfico de barras 12 meses (regla de 3 niveles)

Solo en 07: contenedor `flex align-end` gap 5px, height 74px. **Regla de énfasis en tres niveles** (capturada por el crítico): mes próximo (ago) barra `#1A1917` plena de **64px**; meses comprometidos (sep–feb) `#1A1917` con `opacity:.75` y **17px**; meses libres (mar–jul) stubs de **3px** en `#DDD9CF`. Tope redondeado `3px 3px 0 0`. Labels mono 400 9px centrados (ago…jul). Pie con divisor: "ago $ 339.550 · desde sep $ 86.250" mono 11px gris vs "en marzo quedás libre" 500 11px verde. Sin ejes ni valores por barra.

### 3.26 Card de compra en cuotas

En 07: fila padding 12px 14px, columna gap 7px. Línea 1: nombre 500 14px + badge CUOTA x/N mono. Línea 2: barra 4px track `#F0EDE5` fill `#1A1917` — **progreso = cuotas pagadas** (33% para 4/12, 83% para 5/6, 67% para 2/3). Línea 3 `justify-space-between`: "$ 86.250/mes · Visa •• 4321" mono 11px vs "termina feb 2027" Rubik 11px.

### 3.27 Fila de tenencia (vocabulario de frescura)

En 08: fila padding 10px 14px sin ícono. Izquierda: nombre 500 13.5px + sub mono 400 10.5px gris ("USD 9.500", "Mercado Pago + Galicia", "rinde diario"). Derecha: monto mono 600 12.5px + meta de frescura 400 10px `#9B958B`. **Vocabulario de frescura, 4 variantes:** "al TC de hoy" · "valuado hoy" · "hace 3 días" (sigue gris por ser <30 días — confirma la regla de la nota) · **vencida**: "valuación de hace 39 días" en `#A66A00` + acción "· actualizar" verde inline, monto también en ámbar, fecha "1 jun". Regla verbatim de la nota: "Valuaciones de más de 30 días en ámbar, con acción de actualizar en la fila."

### 3.28 Barras de composición patrimonial (regla de escala)

En 08: 7 filas con label Rubik 400 10.5px (width fija 92px) + barra `flex:1` 6px radius 3 (track `#F0EDE5`, fill `#1A1917`) + porcentaje mono 400 10.5px (width 36px, right). **Regla capturada por el crítico: las barras están normalizadas al MÁXIMO, no al 100%** — Dólar MEP 29 % → width 100%; CEDEARs 24 % → 82%; billete 19 % → 63%; FCI 11 % → 37%; Cripto 7 % → 22%; Plazo fijo 6 % → 21%; remunerada 4 % → 13%. Escala relativa al mayor, monocroma en tinta (sin colores por categoría) — decisión de diseño a replicar.

### 3.29 Sparkline de evolución patrimonial

En 08: SVG `viewBox 0 0 108 40`, polyline ascendente stroke `#1A1917` 1.5 round, `fill:none`; **punto final círculo r2.5 fill `#1E6E52`**; caption "ago 25 — jul 26" mono 400 9.5px `#9B958B` centrado.

### 3.30 Avatar circular con inicial (normal / pendiente punteado)

Rubik 600. Header: 34px, bg `#1A1917`, "J" 13px `#F7F5F1`. Lista (09): 36px, 14px; Juanse `#1A1917`, Vale `#6F6A63`. **Variante pendiente:** 36px, borde `1.5px dashed #C89A4D`, bg `#FBF6EC`, "S" en `#A66A00` — mismo lenguaje punteado que ESTIMADA. Oscuro: invertido, bg `#F2EFE9`, letra `#141312`.

### 3.31 Fila de miembro del hogar

En 09: header de card con ícono users 19px + "Coghlan" 600 16px + "2 miembros · 1 invitación pendiente". Fila: padding 12px 16px gap 12px, avatar 36px + nombre 500 14px + sub 400 11px ("vos", "adulta del hogar", "invitada hace 5 días · sin responder") + badge de rol. La invitación pendiente agrega fila de acciones con padding-left 48px gap 16px: "Reenviar" verde / "Revocar" `#B3402E`. Debajo de la card, la card de visibilidad (candado + statement + badges explicados).

### 3.32 Barra de búsqueda

Solo en 05: bg blanco, borde `#E4E0D8`, radius 12px, padding 10px 12px, lupa 16px + placeholder 400 13px `#9B958B` "Buscar comercio o categoría".

### 3.33 Hero numérico (display de monto grande)

Patrón: label 500 12px gris + monto mono 500 con ls −.02em + meta mono 11px gris. Escala por jerarquía: **52px** (tecleo, 03) → **40px** (heros de pantalla, 01a y 07) → **34px** (card de 04) → **30px** (resumen proyectado 06) → **28px** (total patrimonio 08, `nowrap`). El mismo dato "$ 539.200" aparece a 40px (01a) y 34px (04) — ver §6.

### 3.34 Encabezado de sección de lista

Rubik 600 12px `#6F6A63`, siempre **fuera** de la card, nunca adentro. Verbatim: "Vivienda / Comida / Ahorro / Salud / Servicios / Suscripciones" (01a/01b/10); "Para atender / Últimos movimientos" (04); "Hoy / Ayer / 8 jul" (05); "Consumos del ciclo · 18" (06, con contador); "Compras en cuotas" (07); "Tenencias" (08). Márgenes variables por pantalla (ver §6).

### 3.35 Status bar, home indicator y marco de pantalla

**Status bar:** 47px, "9:41" 600 15px, señal de 4 barras (3px de ancho, alturas 4/6/8/10px), wifi 16px, batería 25×12 al 72%. **Home indicator:** 134×5px radius 3, `#1A1917` opacity .85, bottom 8px. **Marco:** 390×844, radius 34, borde `#D9D5CB`, sombra suave; cada frame lleva `data-screen-label` y rótulo de canvas mono 600 11px. Variantes clara/oscura en los tres. Idénticos en los 13 frames.

---

## 4. Dataset del export (para el seed)

Un solo dataset entrelazado — no datos sueltos por pantalla. Coherencia narrativa detectada por el crítico: el gasto que se está cargando en 03 ($ 84.320, Visa •• 4321, Súper, ciclo 28 jul) **es** el movimiento "Coto" ya cargado en 04, 05 y 06; "Rappi $ 18.400" está simultáneamente en la bandeja de 05 y como "sin categorizar" en la lista del ciclo de 06.

### 4.1 Hogar y miembros

- **Hogar: "Coghlan"** — "2 miembros · 1 invitación pendiente". Fecha del dataset: **viernes 10 de julio de 2026, 9:41**.
- **Juanse** — administrador, "vos", avatar "J" (tinta). Es el usuario de todas las pantallas.
- **Vale** — miembro, "adulta del hogar", avatar "V" (`#6F6A63`).
- **sofi.rios@gmail.com** — invitación pendiente, "invitada hace 5 días · sin responder" (⇒ invitada el 5 jul), badge PENDIENTE, acciones Reenviar/Revocar.
- Visibilidad: HOGAR → "presupuesto y movimientos compartidos: los ven Juanse y Vale"; PERSONAL → "tus partidas privadas: solo las ves vos".

### 4.2 Cuentas y medios de pago

Chips de 03: **Efectivo · Galicia (cuenta) · MP / Mercado Pago · Visa •• 4321 · MC •• 8810**. La transferencia recibida entra por Galicia. El FCI money market vive en "Mercado Pago + Galicia". No hay pantalla de gestión de cuentas (hueco declarado).

### 4.3 Tarjetas de crédito

| Tarjeta | Ciclo / fechas | Estado | Datos |
|---|---|---|---|
| **Visa Galicia •• 4321** | Ciclo actual 29 jun – 28 jul; cierre **28 jul** (ESTIMADA), vence **6 ago** (ESTIMADA); chevron a ciclo siguiente deshabilitado | ambas fechas con acción "confirmar fecha" | Proyectado **$ 840.450** = Consumos $ 486.200 + Cuotas del mes $ 296.250 + Impuestos estimados $ 58.000 (editable). "Consumos del ciclo · 18" (5 visibles). |
| **Mastercard •• 8810** | "cierra 13 jul" (visible en meta de movimientos) | — | Lleva YPF, MercadoLibre y Zapatillas. |
| **Mastercard BBVA** | "cierra en 3 días" (10 jul + 3 = 13 jul → probablemente la misma •• 8810, naming inconsistente, ver §6) | badge **CONFIRMADA** (refiere a la fecha) | "proyectado $ 152.700" (sin desglose visible). |

### 4.4 Presupuesto del hogar — julio 2026

Totales: **asignado $ 2.860.000 · gastado $ 2.320.800 · disponible $ 539.200** · "81 % gastado" · "día 10 de 31 · quedan 21 días" (marcador al 32%).

Partidas dibujadas (12 de las 15 — ver verificación abajo):

| Grupo | Partida | Gastado / Asignado | Estado / notas |
|---|---|---|---|
| Vivienda | Alquiler | $ 780.000 / $ 780.000 | pagado · fijo |
| Vivienda | Expensas | $ 165.000 / $ 165.000 | pagado |
| Comida | Supermercado | $ 268.400 / $ 520.000 | queda $ 251.600 (tinta); barra 52% ámbar; "a este ritmo terminás $ 31.200 arriba" |
| Comida | Delivery | $ 71.300 / $ 90.000 | queda $ 18.700 (ámbar); barra 79% ámbar; "a este ritmo terminás $ 7.100 arriba" |
| Comida | Restaurantes | $ 45.000 / $ 120.000 | queda $ 75.000; barra 38% verde |
| Ahorro | Ahorro e inversión | $ 400.000 / $ 400.000 | transferido · a Broker |
| Salud | Prepaga | $ 310.000 / $ 310.000 | pagado · fijo |
| Salud | Farmacia | $ 12.500 / $ 40.000 | queda $ 27.500; barra 31% verde |
| Servicios | Luz | $ 0 / $ 45.000 | queda $ 45.000; barra vacía; "recurrente · vence el 18 jul"; ícono ámbar |
| Servicios | Internet | $ 38.000 / $ 38.000 | pagado |
| Servicios | Celular | $ 22.000 / $ 22.000 | pagado |
| Suscripciones | Suscripciones | $ 41.200 / $ 55.000 | badge ROLLOVER; queda $ 27.600 (= 55.000 + 13.800 − 41.200); barra 75%; "arrastrás + $ 13.800 de junio" |

### 4.5 Presupuesto de agosto (armado, 02)

Ajuste general por inflación **+ 2,5 %** (alternativa: "Copiar sin ajuste"). Filas dibujadas:

| Partida | Julio (tachado) | Agosto | Delta |
|---|---|---|---|
| Alquiler | $ 780.000 | $ 799.500 | + $ 19.500 |
| Expensas | $ 165.000 | $ 169.125 | + $ 4.125 |
| Luz | $ 45.000 | $ 46.125 | + $ 1.125 |
| Internet | — | **$ 0** | desactivada este mes · la paga Vale |
| Celular | $ 22.000 | $ 22.550 | + $ 550 |
| Supermercado | $ 520.000 | $ 533.000 | + $ 13.000 |
| Delivery | $ 90.000 | $ 92.250 | + $ 2.250 |
| Restaurantes | $ 120.000 | $ 123.000 | + $ 3.000 |

Footer: "Total agosto · **14 partidas activas**" → **$ 2.892.550**; con todo activo, **$ 2.931.500** (dato de la nota ↳).

### 4.6 Presupuesto personal de Juanse

**No hay datos.** La vista Personal es hueco declarado del export. Lo único que se sabe: existe el toggle Hogar/Personal en 01a/03/05, y el movimiento "Café Cuervo" va a la categoría/partida **"Gustos"** con ámbito PERSONAL. El seed deberá definir las partidas personales sin referencia visual.

### 4.7 Movimientos (historial)

| Comercio | Fecha | Importe | Categoría | Medio | Ciclo | Ámbito |
|---|---|---|---|---|---|---|
| Coto | hoy (10 jul) | $ 84.320 | Supermercado / Súper | Visa •• 4321 | cierra 28 jul | HOGAR |
| Café Cuervo | hoy | $ 6.800 | Gustos | Mercado Pago | — | PERSONAL |
| YPF | hoy | $ 45.000 | Nafta | Mastercard •• 8810 | cierra 13 jul | HOGAR |
| Farmacity | ayer (9 jul) | $ 8.900 | Farmacia | Mercado Pago | — | HOGAR |
| Cinemark Palermo | 8 jul | $ 16.800 | Entretenimiento | Visa •• 4321 | cierra 28 jul | HOGAR |

En 04 las mismas filas Coto/YPF **omiten** el dato de ciclo (condensación no declarada, ver §6).

### 4.8 Bandeja de entrada (3 ítems sin categorizar)

1. **Rappi** — hoy · Visa •• 4321 — **$ 18.400** — chips sugeridos: **Delivery** (preseleccionada) · Restaurantes · Súper · "todas →". También aparece en 06 como "hoy · sin categorizar".
2. **Transferencia recibida** — hoy · Galicia — **+ $ 120.000** (ingreso, verde).
3. **MercadoLibre** — ayer · Mastercard •• 8810 — **$ 32.900**.

Eco en 04: "3 movimientos sin categorizar / Rappi, una transferencia y uno más" + acción "Categorizar".

### 4.9 Compras en cuotas

Total comprometido del mes: **$ 339.550** — "3 compras en cuotas · Visa y Mastercard".

| Compra | Cuota | Progreso barra | Mensual | Tarjeta | Fin |
|---|---|---|---|---|---|
| Aire acondicionado | CUOTA 4/12 | 33% | $ 86.250/mes | Visa •• 4321 | "termina feb 2027" |
| Notebook | CUOTA 5/6 | 83% | $ 210.000/mes | Visa •• 4321 | "termina ago 2026" |
| Zapatillas | CUOTA 2/3 | 67% | $ 43.300/mes | Mastercard •• 8810 | "termina ago 2026" |

Gráfico 12 meses: ago pleno, sep–feb comprometidos, mar–jul libres; "ago $ 339.550 · desde sep $ 86.250"; "en marzo quedás libre". En 06, Aire ($ 86.250) y Notebook ($ 210.000) figuran con fecha "1 jul · Hogar".

### 4.10 Patrimonio

Total del hogar: **$ 47.400.000 ≈ USD 32.200**. TC: **MEP $ 1.470 · hoy 10 jul** (opciones MEP / blue / oficial). Sparkline "ago 25 — jul 26" ascendente.

| Tenencia | Cantidad / detalle | Valuación ARS | Frescura | % composición |
|---|---|---|---|---|
| Dólar MEP | USD 9.500 | $ 13.965.000 | al TC de hoy | 29 % |
| CEDEARs | USD 7.800 | $ 11.466.000 | valuado hoy | 24 % |
| Dólar billete | USD 6.000 | $ 8.820.000 | al TC de hoy | 19 % |
| FCI money market | Mercado Pago + Galicia | $ 5.200.000 | valuado hoy | 11 % |
| Cripto | USD 2.100 | $ 3.087.000 | hace 3 días | 7 % |
| Plazo fijo | — | $ 3.000.000 (en ámbar) | **"valuación de hace 39 días"** (1 jun) + "· actualizar" | 6 % |
| Cuenta remunerada MP | rinde diario | $ 1.850.000 | valuado hoy | 4 % |

### 4.11 Resumen (04) — "Para atender"

1. "Mastercard BBVA cierra en 3 días" — "proyectado $ 152.700" + CONFIRMADA + chevron.
2. "Vence Luz el 18 jul" — "$ 45.000 sugerido · recurrente" + chevron (rayo ámbar).
3. "3 movimientos sin categorizar" — "Rappi, una transferencia y uno más" + acción "Categorizar".

### 4.12 Verificaciones aritméticas

**Cierran ✓:**

- Presupuesto interno: 2.320.800 + 539.200 = 2.860.000 ✓; 2.320.800 / 2.860.000 = 81,1 % → "81 %" ✓; día 10/31 = 32,3 % → marcador en 32% ✓.
- **Tenencias × TC MEP $ 1.470:** 9.500 × 1.470 = 13.965.000 ✓ · 7.800 × 1.470 = 11.466.000 ✓ · 6.000 × 1.470 = 8.820.000 ✓ · 2.100 × 1.470 = 3.087.000 ✓. USD total: 47.400.000 / 1.470 ≈ 32.245 → "≈ USD 32.200" (con ≈, correcto).
- Inflación de 02: todas las filas son exactamente julio × 1,025 (780.000 → 799.500, etc.) ✓; y **2.931.500 = 2.860.000 × 1,025 exacto** ("con todo activo") ✓; 2.931.500 − 2.892.550 = 38.950 = Internet 38.000 × 1,025 ✓. De acá se deriva que **el presupuesto tiene 15 partidas** (las 14 activas de agosto + Internet): el export dibuja 12, y las 3 restantes suman $ 275.000 de asignado (2.860.000 − 2.585.000 visibles) sin nombre ni grupo — el seed debe inventariarlas.
- Cuotas: 86.250 + 210.000 + 43.300 = 339.550 ✓; "desde sep $ 86.250" ✓ (Notebook y Zapatillas terminan en ago); proyectado Visa 486.200 + 296.250 + 58.000 = 840.450 ✓; cuotas del mes Visa 86.250 + 210.000 = 296.250 ✓.
- Composición: los 7 porcentajes coinciden con valuación/total y suman 100 ✓.
- Suscripciones: queda 27.600 = 55.000 + 13.800 − 41.200 ✓ (rollover en el disponible); barra 75% = 41.200/55.000 ✓ (rollover fuera del denominador — ambigüedad declarada en §6).

**NO cierra ✗ (la decisión está en `DESIGN_NOTES.md`):**

- **Aire acondicionado:** "CUOTA 4/12" en el ciclo que cierra 28 jul (06 y 07) vs "termina feb 2027" (07) vs "en marzo quedás libre" + barras sep–feb comprometidas (07). Con cuota 4 en julio, la 12 caería en marzo–abril 2027; para terminar en feb 2027 la cuota de julio debería ser 5/12 o 6/12. Los tres datos no cierran entre sí.
- **Total de patrimonio:** $ 47.400.000 vs suma de tenencias $ 47.388.000 (diferencia $ 12.000 sin rotular como redondeo; el USD sí usa "≈").
- **"10 pantallas" declaradas, 13 frames renderizados.**
- Proyectado MC BBVA $ 152.700: sin desglose visible (MercadoLibre + YPF + Zapatillas visibles suman $ 121.200; el resto no está dibujado — no es error, es dato parcial).

---

## 5. Los cuatro huecos declarados por el export

Card "FUERA DE ALCANCE, ANOTADO" (final del canvas, visible solo con `mostrarNotas`), verbatim:

> "Espacios que el documento no define y quedan para una próxima pasada: el formulario de conciliación abierto (06), la vista Personal del presupuesto con las partidas de Juanse, la gestión de cuentas y el alta de tenencia. No se inventaron funcionalidades para llenarlos."

1. **El formulario de conciliación abierto (06)** — existe la entrada "Conciliar resumen", no la hoja.
2. **La vista Personal del presupuesto con las partidas de Juanse** — existe el toggle, no la vista.
3. **La gestión de cuentas** — los medios existen como chips, sin pantalla propia.
4. **El alta de tenencia** — existe el CTA "Cargar tenencia" y los chips de sugerencia, no el formulario.

### Huecos adicionales detectados por el crítico

Estados **spec'd en notas ↳ pero nunca dibujados** — a resolver siguiendo el sistema, sin inventar:

- **Botón "Guardar sin categoría"** (nota de 03): el botón dibujado siempre dice "Listo"; la variante no existe en ningún frame.
- **Grilla inline abierta de la bandeja** (nota de 05: "la grilla se abre inline"): solo se dibuja la fila de 3 chips + "todas →", nunca la grilla de 4 columnas abierta.
- **Dropdowns de los filtros** Cuenta/Categoría/Miembro (05): nunca abiertos.
- **Reacomodo de consumos al corregir la fecha de cierre** (nota de 06): sin representación.
- (Parcialmente solapado con el hueco declarado: la vista con el toggle en "Personal" nunca se muestra.)

También vale declarar como ausencia: **no hay estados pressed/focus/drag dibujados en ningún frame**; los únicos estados interactivos del documento son `a:hover → #17553F`, `::selection → #D9E8E1`, el chevron deshabilitado del paginador de ciclo (`#D8D4CB`) y el placeholder de búsqueda (`#9B958B`).

---

## 6. Inconsistencias detectadas

Lista completa (lente de inconsistencias + correcciones del crítico; cuando se contradicen, gana el crítico):

1. **Near-duplicate `#F0EDE5` vs `#F0EDE6`.** Track de barras (24 usos, ej. L117, L140, L698) vs divisor de filas (41 usos, ej. L120, L144, L443), a 1 unidad de distancia. El modo oscuro usa UN solo `#2E2B26` para ambos roles (L1542, L1560): evidencia de que la dupla clara es accidental.
2. **El track de la barra del mes cambia de color entre frames.** `#E7E3DA` en 01a (L99) vs `#F0EDE5` en 04 (L698); el timeline de 06 usa un tercer gris `#EDEAE2` (L998). `#E7E3DA` y `#EDEAE2` aparecen 1 sola vez cada uno.
3. **Color del monto "queda" inconsistente entre partidas en atención.** Supermercado y Delivery están ambas "a este ritmo terminás arriba", pero el queda de Supermercado es tinta `#1A1917` ($ 251.600, L138) y el de Delivery ámbar `#A66A00` ($ 18.700, L149). Se reproduce idéntico en dark (L1581 vs L1592). La regla (¿umbral de %? ¿monto absoluto bajo?) no está declarada.
4. **Ícono de categoría a veces ámbar, sin regla escrita.** Luz `#A66A00` (L266) y el rayo de 04 (L722), pero Supermercado/Delivery — también en atención — mantienen `#6F6A63`. Refinamiento del crítico: la regla implícita es "ícono ámbar = partida con **aviso activo** (vencimiento)", no "en riesgo".
5. **Título de header de detalle: 16px vs 17px.** "Nuevo gasto" 600 16px (L566) vs 17px en 01a/06/07/09 (L85, L989, L1122, L1438). Las raíces de tab usan 22px.
6. **Ícono volver/cerrar en tres tamaños.** Chevron back 18px en 01a (L84), 20px en 06/07/09; X de cerrar 22px en 02/03.
7. **Segmented Hogar/Personal: tres anatomías.** 01a radius 11/9 font 13px; 03 radius 9/7 font 11.5px; en 05 ya no es segmented sino dos chips sueltos en la fila de filtros (L828–829).
8. **Tag HOGAR/PERSONAL en tres tamaños.** 8px `1.5px 4px` (filas de movimiento), 8.5px `2px 6px` (09), 9px `2px 6px` (leyenda del canvas).
9. **Chips semánticos: leyenda 9px vs pantallas 8.5px, padding 6 vs 5.** ESTIMADA 8.5px `2px 5px` en uso pero PENDIENTE (mismo lenguaje) `2px 6px` (L1471); ROLLOVER y CUOTA con la misma divergencia leyenda/uso.
10. **Padding vertical de filas: 9/10/11/12px según pantalla.** 01a 11px, 01b 10px, bandeja 9px, 06 10px, 07 12px, 09 12px 16px. La nota de 01b justifica condensar el header, no las filas.
11. **Márgenes de los labels de sección, todos distintos.** `12px 2px 7px` (01a), `10px 2px 6px` (01b), `18px 22px 7px` (04), `11px 2px 5px` (05), `14px 22px 6px` (06), `16px 22px 6px` (07), `10px 22px 5px` (08).
12. **CTA primario: 3 combinaciones de padding/font.** 15px 0 / 15px (02, 03); 14px 0 / 14.5px (09); 14px 30px / 14.5px (01c, 08b). Todos radius 12px.
13. **Radio de chips: 8, 9 y 10px** según contexto (TC y bandeja 8; filtros, cuotas y sugerencias 9; medios de pago 10).
14. **Naming de tarjetas inconsistente.** "MC •• 8810" (03) vs "Mastercard •• 8810" (04/05/07) vs "Mastercard BBVA" sin numeración (04). "Visa •• 4321" vs "Visa Galicia •• 4321" (06).
15. **Asignado julio $ 2.860.000 no cierra con las partidas visibles.** Las 12 dibujadas suman $ 2.585.000 — faltan $ 275.000. La aritmética de 02 (ver §4.12) fija el total en 15 partidas; las 3 restantes no están dibujadas.
16. **Total Patrimonio $ 47.400.000 vs suma $ 47.388.000.** Diferencia de $ 12.000 sin rotular como redondeo (el USD sí usa "≈").
17. **"10 pantallas" declaradas, 13 frames renderizados** (01a/01b/01c, 08/08b, 10).
18. **Dark vs light: sombras y opacidad divergen sin documentar.** Cards claras con sombra `.04` y thumb `.08`; en dark ninguna sombra. Barra pagada `.4` claro vs `.45` oscuro. La nota de 10 documenta colores, no esto.
19. **Mismo dato "$ 539.200" a 40px (01a) y 34px (04).** Probablemente intencional (hero vs card) pero sin nota que lo fije como escala.
20. **Guión de rango: en-dash con espacios vs em-dash.** "29 jun – 28 jul" (06) vs "ago 25 — jul 26" (08).
21. **Metadata de ciclo presente en 05, ausente en 04 para los mismos movimientos.** Coto/YPF muestran "· cierra 28 jul"/"· cierra 13 jul" en 05 y no en 04. Condensación no declarada.
22. **Borde de bandeja `#DCCEB0`: hex huérfano.** Único uso (L832); parece un `#E4E0D8` teñido de ámbar, no existe en la leyenda de tokens.
23. **Timeline de ciclo (06): escala ambigua.** "hoy" a left:29% y cierre a 72% solo cierran si el track termina en el **vencimiento** 6 ago (12/39 ≈ 31%, cierre 30/39 ≈ 77%), no en el cierre 28 jul (el 10 jul sería ~40%). El extremo derecho no tiene rótulo de fecha.
24. **Ambigüedad: denominador de la barra con rollover.** Suscripciones: barra 75% = 41.200/55.000 (base sin rollover) pero "queda $ 27.600" incluye el rollover. Si sumara al denominador sería 60%. Sin definir.
25. **Ambigüedad: chip CONFIRMADA pegado a un monto proyectado (04).** El chip refiere a la fecha de cierre (contrapunto de las ESTIMADA de 06) pero al lado de "proyectado $ 152.700" se lee como monto confirmado. Semántica fecha-vs-monto sin declarar.
26. **Ambigüedad: "Consumos del ciclo · 18" ¿incluye cuotas?** El resumen separa "Consumos $ 486.200" de "Cuotas $ 296.250", pero la lista con ese título mezcla consumos y cuotas (Aire, Notebook). Si el 18 incluye cuotas, el título contradice la partición.
27. **[CORREGIDO POR EL CRÍTICO] `#B3402E` "declarado pero nunca demostrado" es falso.** El rojo SÍ se renderiza: la acción destructiva **"Revocar"** en 09 (L1475). Lo correcto: nunca se demuestra como estado **"excedido" de una partida** (ninguna barra ni monto en rojo), pero sí como link destructivo. Tampoco tiene versión dark.
28. **Chips semánticos sin mapping dark.** La pantalla 10 solo valida los tokens de 01a: `#FBF6EC`, `#E7F0EB`, `#EAEEF7`, `#F1EEE8`, `#DCCEB0`, `#3B5BA5`/ROLLOVER, `#B3402E`, toggle apagado, pista de timeline, barra futura, teclado, chips de medios de pago, CTA primario (¿`#1E6E52` o `#4FA37F`?), estados vacíos y sticky footer no tienen equivalente oscuro definido. La nota dice "semánticos aclarados" pero solo demuestra dos: ámbar → `#C6913B` y verde → `#4FA37F`. Detalles dark sí dibujados y fáciles de perder: avatar invertido, batería `rgba(242,239,233,.4)`, home indicator `#F2EFE9`, sombra del FAB `rgba(79,163,127,.25)`, opacidad .45.
29. **[AGREGADO POR EL CRÍTICO] Cuotas del Aire acondicionado no cierran** (4/12 vs "termina feb 2027" vs "en marzo quedás libre" — detalle en §4.12; decisión en `DESIGN_NOTES.md`).

---

## 7. Mejoras

### 7.1 Aplico directo (no cambian layout ni jerarquía)

1. **Colapsar `#F0EDE5`/`#F0EDE6`/`#E7E3DA`/`#EDEAE2` en 2 tokens explícitos** (pista-progreso y separador-fila); decidir si comparten valor como hace dark (`#2E2B26` único). Cero impacto de layout.
2. **Contraste: terciario `#9B958B` falla AA en texto real.** 2.97:1 sobre blanco y 2.73:1 sobre papel (AA exige 4.5:1). Afecta placeholder de búsqueda, frescuras de tenencia, tachados, partida desactivada, "29 jun", caption del sparkline. Oscurecer a ~`#76716A` o degradar esos textos a `#6F6A63`.
3. **Contraste: ámbar `#A66A00` queda corto en texto chico.** 4.48:1 sobre blanco (falla por centésimas), 4.12:1 sobre papel, 4.16:1 sobre `#FBF6EC`; badge "3" blanco sobre ámbar 4.48:1. Afecta todos los avisos de 11px y chips ESTIMADA/PENDIENTE. Oscurecer a ~`#8F5B00` en claro; dark ya lo resuelve (`#C6913B` sobre `#1E1C1A` = 6.08:1).
4. **Contraste: tab "Personal" inactivo 4.38:1** (`#6F6A63` sobre `#ECE8DF`). Aclarar el track o oscurecer el texto un paso.
5. **Contraste: "$ 0" desactivado a 1.74:1** (`#C9C4BA` sobre blanco). Disabled está exento de AA pero a 14px es ilegible; llevar al menos a ~3:1 (`#A9A399`).
6. **Targets táctiles < 44px: hit-area invisible de 44×44** sin cambiar el dibujo, en: back/cerrar 18–22px, avatar 34px, "confirmar fecha", "· actualizar", "Reenviar"/"Revocar", filtros de 05 (~28px), chips de TC (~26px), chips de bandeja (~26px), mini-segmented de 03 (~25px), "Copiar sin ajuste", "Armar presupuesto de agosto →", "Categorizar". El numpad (50px) y el FAB (52px) ya cumplen.
7. **Definir estados de foco/presión.** El export no define ningún `:focus`/`:active`/pressed (el único `<a>` real es el de 01b). Especificar anillo de foco (ej. 2px `#1E6E52` offset 2px; `#4FA37F` en dark) y pressed para filas, chips y CTAs.
8. **Labels accesibles para iconografía sin texto:** backspace del teclado, FAB "+" (sin label mientras los otros 4 tabs sí tienen), chevrons de mes y de ciclo, lápices de edición, sparkline, y todas las barras de progreso (aportar valor vía aria, ej. "gastado 52% de $ 520.000").
9. **Unificar tags/badges a una sola escala:** 8.5px, ls .08em, padding 2px 5px, radius 4px para todas las variantes (hoy conviven 8/8.5/9px y tres paddings).
10. **Unificar naming de tarjetas:** patrón único "Visa •• 4321" / "Mastercard •• 8810" (banco solo en el título del detalle); corregir "MC •• 8810" y "Mastercard BBVA".
11. **Corregir el total de Patrimonio:** $ 47.388.000, o anteponer "≈" como ya hace el USD.
12. **Unificar guión de rango:** fijar en-dash con espacios ("29 jun – 28 jul") también en el sparkline.
13. **Documentar (o alinear) sombra y opacidad en dark:** dark sin sombras como decisión explícita; unificar opacidad de barra pagada .4/.45 en un solo valor.
14. **Affordance de scroll en carruseles cortados** (medios de pago, filtros con `nowrap/overflow:hidden`): fade de borde o padding que muestre el chip parcial.
15. **Unificar el CTA primario:** un solo spec (radius 12 + padding 15px vertical + 600 15px, o 14.5px) para las 5 instancias.
16. **Escribir la regla del ícono ámbar y del monto "queda" ámbar** como spec ("ícono ámbar = aviso activo"; "monto ámbar cuando …") para que L138 vs L149 y L135 vs L266 dejen de ser adivinanza.

### 7.2 Propongo, espera ok de Juanse (cambian layout / jerarquía / flujo)

1. **Agregar un frame (o fila) con partida excedida en rojo.** Nada valida `#B3402E` como estado "excedido" en contexto real (barra 100%+, monto negativo, "te pasaste $ X"). Propuesta: variante de fila en 01a o frame 01d, en claro y oscuro.
2. **Frame dark adicional con chips y estados semánticos.** Extender la validación oscura más allá de 01a: ESTIMADA/CONFIRMADA/ROLLOVER/CUOTA/PENDIENTE, bandeja con borde ámbar y estados de atención, para fijar los fondos de chip oscuros que hoy no existen.
3. **06: convertir "Conciliar resumen" en fila accionable.** Hoy es texto verde + descripción sin chevron ni forma de botón; como acción clave del diferencial argentino merece affordance clara. Cambia la anatomía de la card.
4. **Unificar el selector Hogar/Personal de 05 con el segmented de 01a/03.** Mover Hogar/Personal a un segmented propio (o al header) reordena la fila de filtros.
5. **Igualar la metadata de movimientos entre 04 y 05.** Decidir si el Resumen muestra "· cierra 28 jul" o si la condensación se declara como regla. Agregar el dato cambia la densidad de 04.
6. **Rotular el extremo derecho del timeline de ciclo (06):** agregar "6 ago" bajo el hito derecho para que la escala 29 jun → 6 ago sea legible y el 29% de "hoy" deje de ser ambiguo.
7. **Dibujar el estado "grilla inline abierta" de la bandeja (05):** un frame 05b con el flujo de categorización en tanda, para no inventar la transición.
8. **Definir la barra de partida con rollover:** elegir e ilustrar el denominador (55.000 → 75%, 68.800 → 60%, o barra apilada base+rollover en azul `#3B5BA5`).

---

## 8. Mapa pantalla → ruta

| Pantalla del export | Ruta de la app | Notas |
|---|---|---|
| 01a / 01b | `/presupuesto` | Con toggle Hogar/Personal y header condensado por scroll (01b es el mismo componente scrolleado, no otra ruta). |
| 01c | `/presupuesto` | Estado vacío de la misma ruta (sin presupuesto del mes). |
| 02 | `/presupuesto/armar` | Modal; entrada desde el link "Armar presupuesto de agosto →" de 01b y desde el CTA de 01c. |
| 03 | `/gasto/nuevo` | Modal pantalla completa, se abre desde el FAB "+" del tab bar. |
| 04 | `/resumen` | Default tras login (tab de apertura). |
| 05 | `/movimientos` | Incluye la bandeja de entrada arriba del historial. |
| 06 | `/tarjetas/[id]` | Pushed sin tab bar; entrada desde los avisos de cierre en 04 y desde la metadata "· cierra …" de 05. |
| 07 | `/cuotas` | Pushed sin tab bar. |
| 08 / 08b | `/patrimonio` | 08b es el estado vacío de la misma ruta. |
| 09 | `/hogar` | Pushed sin tab bar; entrada desde el avatar. |
| 10 | — (tema oscuro global) | No es ruta: valida los tokens `dark` de toda la app. |

**Huecos declarados → dónde viven:**

| Hueco | Resolución de ruta |
|---|---|
| Conciliación del resumen (06) | Hoja inferior en `/tarjetas/[id]` |
| Vista Personal del presupuesto | `/presupuesto` con el toggle en Personal |
| Gestión de cuentas | `/cuentas` (desde el avatar) |
| Alta de tenencia | Hoja inferior en `/patrimonio` |

**Extras de app (sin diseño en el export):** `/login`, `/registro`, `/invitacion/[token]` (el flujo de "Por email. La persona elige su clave al entrar."), `/sistema` (QA visual de tokens y componentes contra el export).

---

## 9. Props del documento .dc

El archivo es un componente DC con runtime propio (`<script src="./support.js">`) y props editables definidas en el script DCLogic (L1666–1675):

- **`notas`** (boolean, default `true`): controla todas las anotaciones ↳ y la card "FUERA DE ALCANCE" vía `<sc-if value="{{ mostrarNotas }}">` — son una capa condicional apagable, no contenido fijo de las pantallas.
- **`fondo`** (enum): papel `#E9E6DF` (default) / blanco `#F4F2EE` / gris `#DEDCD6` — fondos del canvas, no de la app.
- Cada frame lleva **`data-screen-label`** (ej. "01a Presupuesto", "06 Tarjeta ciclo Visa"): IDs máquina útiles como referencia estable.

Nada de esto es producto: es tooling del export. Sirve para QA visual (renderizar el `.dc` con `notas:false` y comparar screenshot contra la app pantalla por pantalla usando los `data-screen-label`).
