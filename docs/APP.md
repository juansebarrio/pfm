# Fin de mes — Guía completa de la app

> PFM (personal finance manager) personal y familiar, hecho para Argentina.
> Mobile-first, criterio contable por devengado, la plata siempre en pesos
> enteros. En producción: **https://pfm-mu.vercel.app**

Este documento explica qué hace la app, cómo está construida y cómo funciona
cada pieza. Es el mapa mental completo del proyecto.

---

## 1. Qué es y para quién

**Fin de mes** es una app para llevar las finanzas de un hogar argentino sin
pelearse con planillas ni con apps pensadas para otro país. Resuelve tres cosas
que las herramientas genéricas hacen mal acá:

1. **Presupuesto por partidas en dos ámbitos a la vez.** Un mismo usuario maneja
   la plata **del hogar** (compartida con su pareja/familia) y la **personal**
   (privada, que nadie más ve), sin mezclar.
2. **Tarjetas con ciclos reales.** No alcanza con "gasté $X"; importa en qué
   **resumen** cae ese gasto: cuándo cierra, cuándo vence, cuánto se proyecta.
   La app modela cierre y vencimiento reales, compras en cuotas y la
   conciliación contra el resumen que llega.
3. **Patrimonio con el dólar siempre presente.** Tenencias en pesos y dólares,
   valuadas al tipo de cambio (MEP / blue / oficial), con la fecha de la última
   valuación siempre a la vista.

La filosofía es de **fricción baja y control total**: cargar un gasto lleva
segundos, pero nada entra al presupuesto automáticamente sin que vos lo
confirmes. La app sugiere; vos decidís.

El diseño salió de un export de Claude Design (10 pantallas) que fijó la
identidad visual; el dataset de ejemplo es el "hogar Coghlan" clavado en julio
de 2026.

---

## 2. El stack

| Capa | Tecnología | Por qué |
|---|---|---|
| **Framework** | Next.js 15 (App Router) + React 19 | Server Components por defecto, Server Actions para mutaciones, middleware para auth. Menos JavaScript al cliente. |
| **Lenguaje** | TypeScript (strict) | Tipado fuerte de punta a punta; nada de `any` suelto. |
| **Estilos** | Tailwind CSS v4 (`@theme`) | Tokens de diseño en español (`tinta`, `papel`, `verde`, `ambar`…) definidos como CSS variables; utilidades atómicas. |
| **Base de datos** | Supabase (PostgreSQL) | Postgres administrado con **Row Level Security** en todas las tablas; PostgREST para las queries. |
| **Auth** | Supabase Auth | Email + contraseña y **Google OAuth**; sesión en cookies vía `@supabase/ssr`. |
| **Validación** | Zod v4 | Esquemas que validan toda entrada del cliente en las Server Actions. |
| **Fechas** | date-fns v4 + `@date-fns/tz` | Todos los cortes de mes y ciclo se calculan en `America/Argentina/Buenos_Aires`, corra donde corra el servidor. |
| **Íconos** | lucide-react | Set consistente, tree-shakeable. |
| **Tipografía** | Rubik (texto) + Spline Sans Mono (cifras) | Vía `next/font/google`, self-hosted. Toda cifra de plata va en mono. |
| **Tests** | Vitest | 74 tests sobre el dominio puro (plata, ciclos, cuotas, parser de correo). |
| **PWA** | manifest + service worker | Instalable en Android/iOS. |
| **Hosting** | Vercel | Deploy continuo desde `main`; env vars por entorno. |

### Convenciones transversales

- **La plata es siempre centavos enteros (`bigint`).** Ningún `float` toca un
  importe: se parsea el string tecleado y se opera con enteros. `formatearImporte`
  es la única salida de formato (`$ 84.320,50`, `USD 6.000`), en es-AR.
- **Dominio en español.** Tablas, funciones, tipos y variables tienen nombres de
  negocio en castellano (`movimientos`, `ciclos_tarjeta`, `asegurarCicloParaFecha`).
- **Todo el texto de UI vosea** ("Elegí", "Probá de nuevo", "Armá tu presupuesto").

---

## 3. Arquitectura

```
Navegador (mobile-first, ≤430px)
   │  cookies de sesión
   ▼
middleware.ts ── refresca el token en cada request y protege rutas privadas
   │
   ▼
Next.js App Router
   ├─ Server Components  → leen datos con el cliente Supabase del usuario (RLS)
   ├─ Server Actions     → validan con Zod y mutan (crear gasto, categorizar…)
   └─ Client Components  → interacción (teclado, swipe, hojas, optimistic UI)
   │
   ▼
Supabase (PostgreSQL)
   ├─ RLS en TODAS las tablas (aislamiento por hogar + privacidad personal)
   ├─ funciones SQL security-definer (crear hogar, aceptar invitación…)
   └─ triggers (anti auto-ascenso a admin, generación de ciclos…)
```

### Capas del código

- **`lib/dominio/`** — TypeScript **puro y testeado**, sin dependencias de red:
  `dinero` (formato, centavos, USD↔ARS), `fechas` (BA timezone), `ciclos`
  (asignación y generación de ciclos de tarjeta), `cuotas` (planes de cuotas),
  `presupuesto` (disponible, rollover), `tarjetas`, `correo` (parser de mails).
- **`lib/datos/`** — lectura desde Supabase (`server-only`): arma las vistas que
  consumen las pantallas (`obtenerSesionHogar`, `movimientosCategorizados`,
  `obtenerPresupuestoMes`, `obtenerPatrimonio`…).
- **`app/acciones/`** — **Server Actions**: toda mutación. Validan con Zod,
  chequean pertenencia al hogar y hacen `revalidatePath`.
- **`components/sistema/`** — el design system: `Card`, `Chip`, `Importe`,
  `HojaInferior`, `BarraAvance`, `TecladoNumerico`, `FilaMovimiento`, etc.
- **`supabase/migrations/`** — esquema + RLS + funciones, versionado en SQL.
- **`scripts/`** — `seed` (dataset del export), `rls-check` (auditoría de
  aislamiento), `capturas` (comparativa 1:1 contra el diseño).

---

## 4. Modelo de datos

Todas las tablas cuelgan de un **hogar** y están protegidas por RLS. Enums
principales:

- `rol_hogar`: administrador · miembro
- `tipo_cuenta`: efectivo · banco · billetera · inversion
- `moneda`: ARS · USD
- `visibilidad`: personal · compartido
- `red_tarjeta`: visa · mastercard · amex · otra
- `estado_ciclo`: abierto · cerrado · conciliado
- `estado_fechas_ciclo`: estimado · confirmado
- `tipo_movimiento`: gasto · ingreso · transferencia · pago_resumen
- `ambito_presupuesto`: hogar · personal
- `fuente_tc`: mep · blue · oficial
- `instrumento_tenencia`: dolar_billete · dolar_mep · fci_money_market ·
  plazo_fijo · cedears · cripto · cuenta_remunerada · otro

### Tablas

| Tabla | Qué guarda |
|---|---|
| `hogares` | El hogar; quién lo creó. |
| `miembros_hogar` | Usuarios del hogar, con rol y nombre. |
| `invitaciones` | Invitaciones por email, con token, vencimiento y estado. |
| `cuentas` | Efectivo, banco, billetera, inversión (con moneda y visibilidad). |
| `tarjetas` | Tarjetas con banco, red, últimos 4, día de cierre, impuestos estimados. |
| `ciclos_tarjeta` | Cada resumen: fechas de cierre/vencimiento, estado, total real. |
| `categorias` | Grupos y categorías, por ámbito (hogar o personal). |
| `compras_en_cuotas` | La compra "madre" de un plan de cuotas. |
| `movimientos` | El registro central: gasto, ingreso, transferencia o pago de resumen. |
| `presupuestos` | Un presupuesto por mes y ámbito. |
| `partidas_presupuesto` | El monto asignado a cada categoría dentro de un presupuesto. |
| `recurrentes` | Gastos que se repiten (luz, alquiler): sugieren, no autoinsertan. |
| `tenencias` | Instrumentos de patrimonio con su valuación. |
| `snapshots_patrimonio` | Fotos históricas del patrimonio total. |
| `tipos_cambio` | Cotizaciones cargadas (MEP/blue/oficial) por fecha. |
| `conexiones_gmail` | Conexión de Gmail por usuario (token **cifrado**). |
| `sugerencias_correo` | Movimientos detectados en mails, esperando revisión. |

### Dos ideas que atraviesan todo

- **Ámbito hogar vs. personal.** Cada gasto, categoría y presupuesto pertenece a
  un ámbito. Lo del hogar es `compartido` (lo ven todos los miembros); lo
  personal es privado del usuario. La RLS lo garantiza a nivel base de datos: ni
  siquiera con la API cruda un miembro puede leer lo personal de otro.
- **Movimiento por devengado.** Un movimiento tiene una `fecha` (cuándo ocurrió)
  y, si es de tarjeta, un `ciclo_id` (en qué resumen cae). Las reglas de
  integridad viven en el esquema (un `CHECK` asegura que un gasto sea de *cuenta
  o tarjeta pero no ambas*, que un ingreso solo entre a una cuenta, etc.).

---

## 5. Conceptos de dominio clave

- **Ciclo de tarjeta.** Cada tarjeta genera ciclos (resúmenes) con fecha de
  **cierre** y de **vencimiento**. Mientras no llega el resumen real, las fechas
  son **estimadas** (a partir del día de cierre) y el total es **proyectado**
  (consumos + impuestos estimados). Cuando cerrás el resumen real, pasa a
  **confirmado/conciliado**. La app genera los ciclos futuros que hagan falta
  para que ningún consumo quede "huérfano".
- **Cuotas.** Una compra en N cuotas crea una compra madre + N movimientos hijo.
  Cada cuota devenga el día 1 del mes correspondiente, pero para el ciclo de
  tarjeta manda la fecha real de compra (así la cuota 1 no cae en un resumen que
  ya cerró). Borrar una cuota borra la compra entera (no se rompe la serie).
- **Bandeja de entrada.** Los movimientos que entran **sin categoría** (carga
  rápida, o los que llegan solos) se juntan en una bandeja. Los categorizás con
  un tap y pasan al historial. Nada sin categorizar ensucia los totales.
- **Recurrentes.** Gastos que se repiten (luz, alquiler, prepaga). La app avisa
  cuando se acercan y sugiere el importe, pero **nunca los inserta solos**: los
  confirmás con un tap.
- **Tipo de cambio.** El patrimonio en dólares se valúa al TC activo (MEP por
  defecto). Si no hay TC cargado, la tenencia se marca en ámbar ("sin TC
  cargado") en vez de mostrar $0 como si fuera real. Las valuaciones viejas
  (+30 días) también se marcan.

---

## 6. Funcionalidades, pantalla por pantalla

### Autenticación

- **Login / Registro** con email y contraseña (validación de fuerza, mensajes
  de error claros por caso: credenciales, email sin confirmar, etc.).
- **Continuar con Google** (OAuth), cuando el flag está activo.
- **Ver demo de prueba**: solo en producción, entra sin credenciales a un hogar
  de ejemplo compartido (las credenciales viven en variables de servidor).
- **Invitaciones**: se aceptan desde un link público `/invitacion/[token]`; una
  función SQL valida token, estado y vencimiento y da el alta con el rol.
- El **middleware** protege todo salvo las rutas públicas y refresca el token de
  sesión en cada request.

### Resumen (pantalla de inicio)

El tablero. Corta a propósito, muestra solo lo que importa hoy:

- **Disponible del mes** (ámbito hogar) con barra de avance y marcador del día.
- **Para atender**: avisos ordenados por prioridad — tarjeta que **cierra**
  pronto, resumen que **vence**, **recurrente** por pagar, **bandeja** con
  movimientos sin categorizar, y **sugerencias del correo** (si Gmail está
  conectado).
- **Últimos movimientos** (los 3 más recientes).

### Presupuesto

- Presupuesto **mensual por partidas** (una por categoría), en ámbito **hogar** o
  **personal** (segmented control).
- Muestra asignado / gastado / disponible por partida, con barras.
- **Armar presupuesto** para un mes nuevo; **rollover** de lo no gastado según
  la regla del diseño.
- Navegación entre meses.

### Movimientos

- **Historial** completo agrupado por día ("Hoy", "Ayer", fecha).
- **Bandeja de entrada**: card de borde cálido con los movimientos sin
  categorizar; categorización inline (3 categorías sugeridas + grilla completa),
  optimista. Incluye un **tooltip ⓘ** que explica qué es la bandeja.
- **Buscar** por comercio o categoría.
- **Filtros**: por cuenta/tarjeta, categoría, miembro y **tipo** (solo gastos /
  solo ingresos).
- **Detalle de movimiento**: hoja inferior con importe, categoría, medio, fecha,
  ámbito, ciclo, cuota; permite **editar el comentario** y **borrar**.
- **Swipe-to-delete**: deslizás una fila a la izquierda para borrar (con el
  cascade correcto si es una cuota).

### Alta rápida (nuevo gasto)

Optimizada para cargar en segundos:

- **Teclado numérico** propio; el monto vive como string y se convierte a
  centavos con aritmética entera.
- **Medio de pago** (chips de cuentas y tarjetas); si es tarjeta, muestra en qué
  **ciclo** cae y ofrece **cuotas** (1/3/6/12).
- **Categoría**: grilla de recientes + campo para **escribir una a mano**
  (busca entre las tuyas o crea una nueva) + **comentario** opcional.
- **Ámbito** hogar/personal recordado en `localStorage`.

### Patrimonio

- **Total** valuado en pesos, con el TC activo siempre visible.
- **Tenencias** ordenadas por valor, con barras normalizadas al máximo, estado
  de **frescura** ("al TC de hoy", "hace 3 días", "sin TC cargado").
- **Tipos de cambio**: carga manual de MEP/blue/oficial; se elige la fuente.
- **Snapshots**: evolución histórica del patrimonio.
- Alta de tenencias por instrumento (dólar billete/MEP, FCI, plazo fijo,
  CEDEARs, cripto, cuenta remunerada, etc.).

### Cuentas y tarjetas

- Gestión de **cuentas** (efectivo, banco, billetera, inversión) y **tarjetas**
  (banco, red, últimos 4, día de cierre). Activas primero; las desactivadas se
  atenúan (no hay borrado físico).
- Alta/edición en hojas inferiores.
- **Conexión Gmail** (ver §Sugerencias).

### Detalle de tarjeta

- **Ciclos**: cierre/vencimiento, estado (estimado/confirmado), total proyectado
  vs. real.
- **Conciliación**: cargás el total real del resumen que llegó.
- **Pagos de resumen**: registrás el pago (sale de una cuenta, se aplica al ciclo).

### Hogar

- **Miembros** con su rol (administrador / miembro).
- **Invitar** por email (solo administradores); reenviar y revocar invitaciones.
- **Tema**: toggle **Oscuro / Claro** (el default de la app es **oscuro**).

### Sugerencias del correo (Gmail — opción A)

*(Feature construida, detrás del flag `NEXT_PUBLIC_GOOGLE`; ver `docs/GMAIL.md`.)*

- Conectás tu Gmail (scope **solo lectura**) y la app lee los **últimos 50 mails**.
- Un **parser heurístico** (`lib/dominio/correo.ts`) detecta avisos de consumo de
  bancos y billeteras argentinas (Mercado Pago, BBVA, Galicia, Ualá…) y los
  convierte en **sugerencias** (importe, comercio, últimos 4, fecha).
- Revisás cada una: la **aceptás** (crea el movimiento, con el ciclo correcto si
  matchea una tarjeta) o la **descartás** (no vuelve a sugerirse).
- Las sugerencias son **privadas por usuario** (RLS): el resto del hogar no ve tu
  casilla. El refresh token se guarda **cifrado** (AES-256-GCM).

### Sistema (`/sistema`)

Página interna de **QA visual**: muestra todos los componentes del design system
con datos reales del seed, en claro y oscuro lado a lado.

---

## 7. Seguridad y privacidad

- **RLS en todas las tablas.** Patrón general: leés/escribís solo si sos miembro
  del hogar **y** la fila es compartida **o** tuya. Lo personal se filtra por
  dueño. Verificado por `pnpm rls:check`, que crea hogares y usuarios reales y
  comprueba que nadie lea/escriba lo ajeno (incluye el caso del token de Gmail).
- **Trigger anti auto-ascenso.** Un miembro no puede editarse el rol a
  administrador (lo frena un trigger, no solo la policy).
- **Plata en centavos enteros.** Imposible que un redondeo de `float` desvíe un
  importe.
- **Tokens de Gmail cifrados** (AES-256-GCM, clave solo-servidor); la columna del
  token tiene el `SELECT` revocado para el rol autenticado: la lee únicamente el
  servidor.
- **Validación con Zod** en toda Server Action, más el chequeo de pertenencia al
  hogar en cada mutación.

---

## 8. Diseño y experiencia

- **Mobile-first** (ancho máximo 430px; el layout está pensado para 390px).
- **Modo oscuro por defecto**; el claro solo aplica si el usuario lo elige. El
  tema se persiste y se aplica antes del primer paint (sin flash).
- **Tokens en español** (`tinta`, `papel`, `verde`, `ambar-texto`, `separador`…),
  con contrastes ajustados a AA.
- **Cifras en mono** (Spline Sans Mono); texto en Rubik.
- **es-AR y voseo** en todos los textos; formato de plata y fechas argentino.
- **PWA** instalable (Android e iOS). Limitaciones conocidas de iOS: sin push,
  almacenamiento evictable, instalación manual. Offline real queda para más
  adelante.

---

## 9. Testing y verificación

```bash
pnpm test        # Vitest: 74 tests del dominio (plata, ciclos, cuotas, parser)
pnpm lint        # ESLint
pnpm build       # build de producción (Turbopack)
pnpm rls:check   # aislamiento RLS entre hogares y entre miembros
pnpm seed        # reproduce el dataset del export (hogar Coghlan, jul 2026)
```

- El **seed se autoverifica** contra 30+ números del export y es idempotente.
- `docs/comparativa/` tiene capturas 1:1 (claro y oscuro) contra el diseño.
- Usuarios de prueba del seed: `juanse@sobres.local` / `coghlan-juanse-2026`
  (admin) y `vale@sobres.local` / `coghlan-vale-2026` (miembro). *Ojo: correr el
  seed recrea los usuarios e invalida las sesiones abiertas.*

---

## 10. Deploy

- **Vercel**, deploy continuo desde `main` (proyecto `pfm`, prod en
  `https://pfm-mu.vercel.app`).
- **Variables de entorno** por entorno: URL y keys de Supabase (publishable +
  secret), `NEXT_PUBLIC_APP_URL`, el bloque de demo (`NEXT_PUBLIC_DEMO`,
  `DEMO_EMAIL`, `DEMO_PASSWORD`) solo en producción, y el bloque de Google/Gmail
  (`NEXT_PUBLIC_GOOGLE`, `GOOGLE_CLIENT_ID/SECRET`, `GMAIL_TOKEN_KEY`) cuando se
  active.
- **Migraciones** en `supabase/migrations/`, aplicadas con `supabase db push` o
  desde el SQL editor.

---

## 11. Estado actual y roadmap

**En producción hoy:** todo el núcleo (presupuesto, movimientos, tarjetas con
ciclos y cuotas, patrimonio, hogar e invitaciones), modo oscuro por defecto,
botón de demo, y PWA instalable.

**Construido pero inactivo** (esperando setup): login con Google + sugerencias
desde Gmail. Falta aplicar su migración, configurar Google Cloud + el provider en
Supabase, y encender el flag. Paso a paso en `docs/GMAIL.md`.

**Fases siguientes anotadas** (`DESIGN_NOTES.md` §5): cotización automática del
dólar, envío real de emails (Resend), notificaciones push, offline real, export
CSV, y un job para mantener prolija la demo.

---

*Docs relacionados: `README.md` (arranque local), `docs/GMAIL.md` (activar
Google), `DESIGN_AUDIT.md` (auditoría del export), `DESIGN_NOTES.md` (decisiones
de diseño y roadmap).*
