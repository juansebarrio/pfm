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
export). Una partida sin gastos no proyecta (caso Luz).

---

## 2. Mejoras aplicadas directo (no cambian layout ni jerarquía)
Detalle completo con mediciones en `DESIGN_AUDIT.md` §7.1. Estado: se aplican durante
las tandas 1–8; esta lista se va tildando.

- [ ] **Unificación de near-duplicates de color**: `#F0EDE5`/`#F0EDE6` → un solo token
  `crema-2`; ídem pares menores de la rampa detectados en la auditoría.
- [ ] **Ámbar AA en claro**: `#A66A00` (4.48:1 sobre blanco) → `#8F5B00` para texto
  chico; el ámbar original queda para íconos/badges con fondo.
- [ ] **Terciario AA**: `#9B958B` (2.97:1) → oscurecer a ~`#76716A` en textos
  informativos reales (placeholders, metadata de frescura, tachados).
- [ ] **`$ 0` desactivado legible**: `#C9C4BA` (1.74:1) → `#A9A399`.
- [ ] **Targets táctiles 44 px**: hit-area invisible en back/cerrar, chevrons, links
  chicos (`confirmar fecha`, `· actualizar`, `Reenviar/Revocar`), chips y filtros.
- [ ] **Estados de foco visibles**: anillo 2px `#1E6E52` (claro) / `#4FA37F` (dark)
  offset 2px en todo lo interactivo; estados pressed sobrios.
- [ ] **Labels accesibles**: aria-label en FAB `+`, backspace del teclado, chevrons de
  mes/ciclo, lápices de edición; barras de progreso con valor aria.
- [ ] **Escala única de tags**: 8.5px / ls .08em / padding 2px 5px / radio 4px para
  todos los badges (hoy conviven 8/8.5/9px).
- [ ] **Naming único de tarjetas**: `Visa •• 4321` / `Mastercard •• 8810`; banco solo
  en el título del detalle (corrige `MC •• 8810` y `Mastercard BBVA`).
- [ ] **Guión de rango unificado**: en-dash con espacios (`29 jun – 28 jul`).
- [ ] **Fade de scroll en carruseles**: medios de pago (03) y filtros (05) muestran el
  chip cortado con fade en lugar de corte seco.
- [ ] **CTA primario único**: radio 12, padding vertical 15, Rubik 600 15px.
- [ ] **Sombra/opacidad dark documentadas**: dark sin sombras de card; opacidad de
  barra pagada unificada en .4.

## 3. Propuestas que esperan el ok de Juanse (NO aplicadas)
Detalle en `DESIGN_AUDIT.md` §7.2.

1. Frame/fila con partida **excedida** en rojo `#B3402E` (hoy el estado no está
   demostrado en ninguna pantalla).
2. Frame dark adicional con chips y estados semánticos (ESTIMADA/ROLLOVER/bandeja) —
   el dark de los chips hoy se decide por extrapolación.
3. 06: convertir "Conciliar resumen" en fila accionable con affordance clara.
4. 05: unificar el selector Hogar/Personal con el segmented del resto (hoy son chips
   sueltos en la fila de filtros).
5. Igualar metadata de movimientos entre 04 y 05 (`· cierra 28 jul`).
6. Rotular el extremo derecho del timeline de ciclo (`6 ago`).
7. Dibujar el estado "grilla inline abierta" de la bandeja (05b).
8. Barra de partida con rollover: definir denominador ilustrado (hoy aplicamos §1.3).

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
