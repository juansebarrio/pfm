# Plan: llevar Fin de mes a iOS nativo

> ✅ **FASES 0 a 7 EJECUTADAS (2026-07-27).** El proyecto vive en `movil/`. La
> app nativa cubre lo mismo que la web (las 4 tabs, las pantallas de escritura,
> el asistente) más lo que la PWA no puede dar (Face ID, hápticos, swipe real,
> avisos locales). Lo que queda no es código: son las puertas de Apple, y están
> listadas en [APP-STORE.md](APP-STORE.md).
>
> Resultados del spike, decisiones tomadas y estimación recalibrada en **§0**;
> el estado por fase, en **§8**.

---

## 0. Resultados del spike

**Qué se construyó y verificó en el simulador** (iPhone Air, iOS 26, Expo Go):
login nativo con credenciales reales de Supabase, tab bar nativa de 4 tabs, y
la pantalla de Resumen mostrando datos reales del hogar Coghlan.

**La validación que importa**: la app nativa muestra **$ 564.900 disponible y
80 % gastado** — exactamente los mismos números que la web, calculados por el
mismo código de dominio.

### Las tres tesis del plan, verificadas

| Tesis | Resultado |
|---|---|
| El dominio se comparte sin copiar | ✅ **Confirmado.** `movil/` importa `@dominio/dinero` y `@dominio/fechas` directo desde `../lib/dominio`. Cero duplicación, `tsc` limpio. Bastó `watchFolders` en Metro + un alias en tsconfig. |
| La RLS alcanza como seguridad, sin backend intermedio | ✅ **Confirmado.** El cliente nativo consulta Supabase directo; las políticas filtran por hogar y visibilidad igual que en la web. |
| Las consultas de `lib/datos/` se reusan | ✅ **Confirmado.** Se portaron con un solo cambio mecánico: de dónde sale el cliente de Supabase. |

### Decisión tomada: StyleSheet, no NativeWind

El plan original apostaba a NativeWind para conservar los `className` y hacer
mecánico el port de la UI. **No funcionó**: NativeWind estable (4.2.6) es
anterior a React Native 0.86 / Expo SDK 57 y sus clases no se aplican en
runtime — la pantalla renderiza sin estilos, sin ningún error en el bundler.
Su v5 está en preview. Tras confirmarlo, se migró a **StyleSheet con un tema
tipado** (`src/lib/tema.ts`), que funcionó a la primera.

**Impacto en el esfuerzo**: el port de la UI deja de ser copiar clases y pasa
a ser traducir cada `className` a un objeto de estilo. Es la razón principal
por la que la estimación sube (ver abajo). A cambio: los tokens quedan tipados
(el compilador avisa si se usa uno que no existe) y hay una dependencia menos.

### Modo de ejecución: Expo Go (sin `prebuild`)

El proyecto es **managed**: no existe `movil/ios/` ni `movil/android/`, no hay
Podfile ni `.xcworkspace`, y en el simulador solo está instalada Expo Go
(`host.exp.Exponent`). Nada nativo se compiló todavía.

Funciona porque **todos los paquetes nativos que usa el proyecto vienen dentro
de Expo Go** (AsyncStorage, react-native-svg, gesture-handler, reanimated,
screens): el JS se carga por red y los módulos nativos ya están ahí.

**Es deliberado, y conviene sostenerlo.** `prebuild` agrega fricción real
(recompilar ante cada cambio nativo, iteración más lenta, y la decisión de
versionar `ios/` o regenerarlo). Las fases 3–5 son 100 % JavaScript y salen más
rápido sobre Expo Go.

| Fase | ¿Alcanza Expo Go? |
|---|---|
| 3 · las cuatro tabs | ✅ hecho |
| 4 · pantallas de escritura | ✅ todo JS |
| 5 · asistente + sugerencias | ✅ salvo que el streaming pida algo fuera del SDK |
| **6 · Face ID, push, widget, ícono** | ❌ **requiere prebuild + build nativo** |
| **7 · App Store** | ❌ imposible sin build nativo |

**Cuando llegue el prebuild, aparece el problema de Xcode** (26.3 local vs 26.4+
que pide SDK 57). Dos salidas:
1. Actualizar Xcode antes de la Fase 6.
2. **EAS Build** (nube de Expo) — compila con el Xcode correcto del lado de
   Expo, saca al Mac local de la ecuación y es el camino natural a TestFlight.
   **Recomendada**: con esto el Xcode local deja de ser bloqueante.

### Otros hallazgos

1. **El middleware no traduce 1:1.** El portero de sesión de la web se rearmó
   como contexto (`ProveedorSesion`) + ruta índice que redirige. Funciona bien,
   pero es estructura nueva, no portada.
2. **Xcode 26.3 vs SDK 57, que pide 26.4+.** No bloqueó el spike (Expo Go no
   compila nativo), pero **hay que actualizar Xcode antes de cualquier build
   real o envío a la App Store**.
3. **El teclado del simulador no escribe `@`** — limitación de la automatización,
   no de la app: `juanse@sobres.local` sale `juanse"sob`. Durante el spike las
   credenciales quedaron precargadas bajo `__DEV__`; **ya se sacaron**. Para
   entrar en el simulador hay que pegar desde el portapapeles
   (`xcrun simctl pbcopy` + mantener apretado el campo → Paste).
4. **Los cambios de rutas necesitan reinicio de Expo Go**, no alcanza Fast
   Refresh. Bundle limpio: ~11 s; incremental: <100 ms.

### Estimación recalibrada

| | Antes del spike | **Después del spike** |
|---|---|---|
| Fase 0 (fundación) | 1 sesión (±1) | ✅ **Hecha** — ~1 sesión, con la pelea de NativeWind incluida |
| Fases 1–2 (auth + datos) | 2 sesiones | ✅ **Hechas en la misma sesión** — salieron más rápido de lo estimado |
| Fases 3–5 (UI) | 5–7 sesiones | **7–9 sesiones** ⬆️ por StyleSheet (sin reuso de clases) |
| Fases 6–7 (nativo + store) | 2–3 sesiones | 2–3 sesiones (sin cambios) |
| **Total de Claude** | 10–14 sesiones | **11–15 sesiones · 18–28 h** |

**Lectura**: la fundación y los datos salieron **más rápido** de lo estimado
(las tres tesis se validaron en una sesión); la UI sale **más lenta** de lo
estimado (sin NativeWind). Se compensan casi en su totalidad — la estimación
global se mueve poco, pero ahora está apoyada en código que corre, no en
extrapolación.

---

Estado al escribir esto (2026-07-27): la app es una web app Next.js en
producción (pfm-mu.vercel.app) que además funciona como PWA. Este documento
evalúa qué costaría tener una **app iOS nativa de verdad** — no un sitio
envuelto — y propone un camino concreto.

---

## 1. La decisión: Expo (React Native)

Tres caminos posibles, y por qué elijo el del medio.

| Camino | Qué es | Reuso | Esfuerzo |
|---|---|---|---|
| **Capacitor** | La web actual dentro de un WKWebView | 100% | 1–2 semanas |
| **Expo / React Native** ⭐ | UI nativa real, lógica TypeScript compartida | ~35% del código, 100% del backend | **8–12 semanas** |
| **Swift / SwiftUI** | Todo nativo desde cero | 0% (solo el backend) | 4–6 meses |

**Capacitor queda descartado por el pedido explícito**: sigue siendo la web
app: el render es HTML en un WebView. Da App Store y plugins nativos, pero el
scroll, los gestos y los inputs siguen sintiéndose "web". Si en algún momento
la prioridad cambia a "estar en la App Store cuanto antes", es la respuesta
correcta — pero no es lo que se pidió acá.

**Swift queda descartado por costo/beneficio**: tirar 668 líneas de dominio ya
testeado (plata en centavos, cuotas, ciclos de tarjeta, presupuesto) para
reescribirlas en otro lenguaje, y mantener dos implementaciones de las mismas
reglas de negocio para siempre. Solo tendría sentido si hiciera falta algo que
React Native no puede dar (no es el caso de una app de finanzas).

**Expo es el punto óptimo** para este proyecto en particular, por tres razones
que son propias de cómo está construido:

1. **La seguridad ya está en la base.** Las 17 tablas tienen RLS y hay 7
   funciones SQL con la lógica sensible. El cliente nativo puede consultar
   Supabase directo y las políticas siguen protegiendo todo — no hace falta
   reescribir la capa de seguridad ni mantener un backend intermedio.
2. **El dominio es TypeScript puro.** `lib/dominio/` (668 líneas + 74 tests)
   no importa nada de React ni de Next: migra tal cual, con sus tests.
3. **Las dependencias tienen equivalente directo.** Ver tabla en §4.

---

## 2. Qué se reusa y qué se reescribe

Medido sobre el código real:

| Capa | Líneas | Destino |
|---|---|---|
| Base de datos (17 tablas, RLS, 7 funciones SQL) | — | ✅ **Intacta**, cero trabajo |
| `lib/dominio/` (dinero, cuotas, ciclos, presupuesto, fechas) | 668 | ✅ **Copiar tal cual** + sus 74 tests |
| `lib/datos/` (consultas a Supabase) | 1.062 | ⚙️ **~80% reusable** — las consultas quedan, cambia de dónde sale el cliente |
| Tokens de diseño (colores, tamaños, tipografía) | — | ⚙️ **Traducir** de CSS a objetos JS (mecánico) |
| `components/sistema/` (14 componentes) | 735 | ❌ **Reescribir** con primitivas nativas |
| `app/` (15 pantallas de usuario + client components) | ~9.000 | ❌ **Reescribir** la UI |
| API routes (asistente IA, Gmail, invitaciones por mail) | — | ✅ **Quedan en Vercel**, la app las consume |

**Resumen**: ~1.700 líneas viajan casi sin tocar, ~9.700 se reescriben, y todo
el backend (base + rutas de servidor) se queda como está.

### Arquitectura resultante

```
┌──────────────┐        RLS         ┌──────────────┐
│  App iOS     │ ─────────────────▶ │   Supabase   │
│  (Expo)      │  consulta directa  │  (sin cambios)│
└──────┬───────┘                    └──────────────┘
       │  HTTPS
       ▼
┌────────────────────────────┐
│  Vercel (rutas de servidor)│  ← donde viven las API keys
│  · /api/asistente (IA)     │
│  · Gmail OAuth + sync      │
│  · Emails de invitación    │
└────────────────────────────┘
```

La web actual **sigue viva y compartiendo backend**. No es "migrar", es
"agregar un cliente".

---

## 3. Plan por fases

Cada fase deja algo funcionando. Las estimaciones están en **sesiones de
trabajo con Claude Code** (ver §6 para el cálculo y sus supuestos), no en
semanas de dev — el código lo escribe Claude, así que la restricción no es la
velocidad de tipeo sino los ciclos de verificación y las revisiones de Juanse.

### Fase 0 — Fundación (1 semana)
- Monorepo: mover `lib/dominio` a un paquete compartido (`packages/dominio`)
  que consuman web y app. Sin esto, las reglas de plata se duplican.
- Proyecto Expo + TypeScript strict + navegación.
- Cliente Supabase para RN (AsyncStorage + `react-native-url-polyfill`).
- Tokens de diseño traducidos a un tema tipado.
- **Entregable**: app que compila y muestra una pantalla con los tokens.

### Fase 1 — Auth y shell (1 semana)
- Login, registro, sesión persistida, refresh automático.
- Tab bar nativa (4 tabs) + navegación stack + el FAB central.
- **Entregable**: entrás con tu cuenta real y navegás entre tabs vacías.

### Fase 2 — Capa de datos (1 semana)
- Portar `lib/datos/` al cliente nativo (parametrizar el cliente Supabase).
- Estado de servidor con TanStack Query (caché, refetch, optimistic updates).
- **Entregable**: la app lee datos reales del hogar.

### Fase 3 — Las 4 tabs principales (2–3 semanas)
Resumen, Presupuesto, Movimientos, Patrimonio. Incluye los componentes del
sistema: Card, CardPartida, BarraAvance, FilaMovimiento, Importe, Badge, Chip,
IconoCategoria, EstadoVacio.
- **Entregable**: la app ya sirve para consultar tus finanzas.

### Fase 4 — Pantallas de escritura (2–3 semanas)
Alta rápida (con el teclado numérico propio), armar presupuesto, cuentas y
tarjetas, detalle de tarjeta con ciclos, cuotas, hogar e invitaciones.
- **Entregable**: la app reemplaza a la web para el uso diario.

### Fase 5 — Extras (1 semana)
Asistente IA (⚠️ ver §5, el streaming necesita `expo/fetch`) y sugerencias del
correo.
- **Entregable**: paridad de funciones con la web.

### Fase 6 — Lo que justifica ser nativo (1–2 semanas)
Acá es donde se gana lo que la PWA no da:
- Face ID / Touch ID para abrir la app.
- Notificaciones push nativas (cierre de tarjeta, vencimientos).
- Gestos con `react-native-gesture-handler` (swipe-to-delete de verdad, con
  física — reemplaza el hack de pointer-events).
- Haptics al confirmar un gasto.
- Widget de pantalla de inicio con el disponible del mes (opcional, +1 semana).
- Universal links para las invitaciones.

### Fase 7 — App Store (1 semana + revisión)
Íconos, splash, capturas, privacidad, cuenta de desarrollador (USD 99/año),
TestFlight, envío a revisión (1–3 días hábiles, con riesgo de rechazo y
reenvío).

---

## 4. Dependencias: el mapa de traducción

| Hoy | En Expo | Nota |
|---|---|---|
| `@supabase/supabase-js` | igual | Necesita AsyncStorage + url-polyfill |
| `@supabase/ssr` | ✂️ se va | Era para cookies de Next |
| `date-fns` + `@date-fns/tz` | igual | El huso de Buenos Aires sigue funcionando |
| `zod` | igual | Validaciones intactas |
| `lucide-react` | `lucide-react-native` | Mismos íconos |
| `tailwindcss` | NativeWind (o StyleSheet) | Decisión de Fase 0 |
| `next` / `react-dom` | Expo Router / React Native | El reemplazo grande |
| `@anthropic-ai/sdk` | queda en Vercel | La key nunca va al dispositivo |

Perfil muy favorable: casi todo tiene camino directo.

---

## 5. Trampas conocidas (específicas de este proyecto)

1. **El streaming del asistente.** El `fetch` de React Native no soporta leer
   el body por chunks. Hay que usar `expo/fetch` (que sí lo soporta) o SSE. Es
   la única parte de la app que no se porta "obvio".
2. **Sesión sin middleware.** El refresh de token hoy lo hace el middleware de
   Next. En nativo lo maneja el cliente de Supabase con AsyncStorage — hay que
   configurarlo explícitamente y probar el caso "app cerrada una semana".
3. **`lib/datos` recibe `sesion.supabase`.** Está bien diseñado: solo hay que
   parametrizar de dónde viene el cliente. Es refactor mecánico, no rediseño.
4. **Fechas y plata.** Centavos enteros y el huso de Buenos Aires viajan sin
   cambios — es la parte que ya está bien resuelta y testeada.
5. **Dos clientes, un backend.** Cada cambio de esquema afecta a web y app. Por
   eso el monorepo de Fase 0 no es opcional.
6. **Revisión de Apple.** Apps de finanzas reciben más escrutinio: hay que
   tener política de privacidad publicada y explicar qué datos se guardan.

---

## 6. Esfuerzo total

⚠️ **La unidad importa.** Una estimación tipo "8–12 semanas de dev full-time"
sería la correcta si alguien escribiera las ~9.700 líneas a mano. Como el
código lo escribe Claude Code, esa cifra no aplica: la restricción deja de ser
la escritura y pasa a ser (a) los ciclos de verificación en el simulador, (b)
las revisiones de Juanse, y (c) las puertas de Apple.

| Concepto | Estimación |
|---|---|
| Trabajo de Claude | ~10–14 sesiones · **15–25 h activas** |
| Revisión de Juanse | ~4–8 h + sacar la cuenta Apple Developer |
| Puertas de Apple | 2–5 días (cuenta 24–48 h + revisión 1–3 días hábiles) |
| **Tiempo de calendario** | **Lo define la cadencia**: 1 sesión/día ≈ 2 semanas · fines de semana intensos ≈ 4–5 días |

**Dónde está la incertidumbre**: la Fase 0 es la menos predecible (Expo,
dependencias nativas, builds del simulador pelean de formas que no se anticipan
leyendo código): puede salir en 40 minutos o comerse dos sesiones. Las fases
2–5 son las más confiables — traducción mecánica de código que ya existe.

**Lo que Claude no puede hacer** (y por eso no entra en su columna): crear la
cuenta de Apple Developer, probar en un iPhone físico (Face ID, push, gestos
reales), y enviar a revisión.

**Estado del entorno** (verificado 2026-07-27): Xcode 26.3 con first-launch
completo, 5 simuladores de iPhone, Node 25, pnpm 11 → se puede empezar hoy.
Falta solo la cuenta Apple Developer (0 perfiles de aprovisionamiento), que no
bloquea el desarrollo, únicamente la instalación en dispositivo y la
publicación.

Costos recurrentes que aparecen: Apple Developer USD 99/año. Supabase y Vercel
no cambian (mismo backend).

---

## 7. Recomendación de arranque

**No empezar por el proyecto entero.** Hacer primero un *spike* de **una
sesión**: Fase 0 + login + la tab de Resumen leyendo datos reales. Responde con
código —no con estimaciones— las preguntas que definen todo lo demás:

- ¿Se siente realmente nativa, o no vale la pena contra la PWA que ya existe?
- ¿Cuánto duele traducir el diseño a React Native?
- ¿NativeWind o StyleSheet?
- Y la más importante: **¿cuánto tarda de verdad una fase?** El spike calibra
  la estimación de §6 con datos reales en lugar de extrapolación.

Si el spike convence, el resto es ejecución sobre una estimación ya calibrada.
Si la Fase 0 pelea, se sabe el día 1 y no en la mitad del proyecto — y la PWA
sigue en producción sin haberla tocado.

---

## 8. Estado por fase

Todo lo de abajo está en `movil/`, verificado en el simulador (iPhone Air, iOS
26, Expo Go) contra la base real del hogar Coghlan.

| Fase | Estado | Qué quedó |
|---|---|---|
| 0 · Fundación | ✅ | Expo + TS strict + tokens tipados. `lib/dominio` se comparte con la web por `watchFolders` + `paths`, sin copiar un archivo |
| 1 · Auth y shell | ✅ | Login real, sesión en AsyncStorage, tab bar de 4 + FAB. El portero es `index.tsx` con `<Redirect>` |
| 2 · Capa de datos | ✅ | `lib/datos.ts`. Sin TanStack Query: con `useFocusEffect` alcanzó, y una dependencia menos |
| 3 · Las 4 tabs | ✅ | Resumen, Presupuesto, Movimientos, Patrimonio + el sistema de diseño en RN |
| 4 · Escritura | ✅ | Alta rápida con teclado propio, categorizar, armar presupuesto, cuentas y tarjetas, detalle de tarjeta, cuotas, hogar |
| 5 · Asistente | ✅ | Streaming con `expo/fetch` y auth por bearer. **Gmail no**: la feature está dormida en la web (falta migración + setup de Google), así que no hay nada que portar todavía |
| 6 · Lo nativo | ✅ | Face ID, hápticos, swipe con física, avisos locales de cierre y vencimiento. Sin widget de pantalla de inicio: era opcional y pide código nativo + prebuild permanente |
| 7 · App Store | ⏳ | Identidad, ícono, permisos, `eas.json`, `/privacidad` y borrado de cuenta: **hechos**. Falta lo que necesita tu cuenta de Apple → [APP-STORE.md](APP-STORE.md) |

### Lo que no se pudo verificar acá

**Face ID.** Expo Go no lo soporta en iOS (limitación del SDK 57, no un bug
nuestro). El código está y tipa; el camino completo se prueba en el primer
development build. Está anotado como primer ítem del §3 de APP-STORE.md.

**Hápticos.** El simulador no tiene motor háptico: el código corre pero no se
siente nada. Se verifica en un iPhone de verdad.

### Dos cosas que aparecieron y no estaban en el plan

1. **El middleware de Next cortaba a la app nativa.** Los pedidos con
   `Authorization: Bearer` morían en un 307 a `/login` antes de llegar al route
   handler. No estaba en la lista de trampas del §5 y costó un rato de
   diagnóstico, porque el síntoma era la app "pensando" para siempre.

2. **El borrado de cuenta era obligatorio y no existía.** Apple lo exige desde
   la app desde 2022. Se construyó para las dos apps y se probó contra la base
   con usuarios descartables (`pnpm prueba:borrado`). En el camino apareció un
   choque real: el trigger `proteger_rol_miembro` rechaza cambios de rol hechos
   con la service key, así que el ascenso del sucesor va con el JWT del que se
   va — que además es la semántica correcta.
