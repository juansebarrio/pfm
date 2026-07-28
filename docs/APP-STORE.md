# Enviar Fin de mes a la App Store

Todo lo que se podía dejar hecho desde el código está hecho y verificado. Lo
que queda son **puertas externas**: cosas que necesitan tu cuenta de Apple, tu
tarjeta o tu decisión. Este documento es la lista, en orden, con lo que hay que
mirar en cada paso.

---

## Estado actual

| Ya está | Detalle |
|---|---|
| Identidad de la app | `Fin de mes`, bundle `com.juansebarrio.findemes`, slug `fin-de-mes` |
| Ícono 1024×1024 | Generado del mismo SVG que el ícono de la PWA. Verificado: el prebuild lo aplana **sin canal alfa**, que es lo que rechaza App Store Connect |
| Splash | Marca sobre el verde de la app |
| Permiso de Face ID | En español rioplatense, en `movil/locales/es.json`. Verificado: llega a `NSFaceIDUsageDescription` y a `es.lproj/InfoPlist.strings` |
| Idioma | `CFBundleLocalizations: ["es-AR"]` |
| Cifrado | `usesNonExemptEncryption: false` — solo HTTPS estándar, así que no hay papeleo de exportación |
| Política de privacidad | Publicada en `/privacidad`, pública sin login (Apple la lee antes de crear cuenta) |
| Borrado de cuenta | Desde Hogar, en las dos apps. Probado contra la base con `pnpm prueba:borrado` |
| Login limpio | Sin credenciales precargadas. Ojo al probar en el simulador: el teclado automatizado no escribe la arroba (`juanse@sobres.local` sale `juanse"sob`) — hay que pegar desde el portapapeles con `xcrun simctl pbcopy` |
| Perfiles de build | `movil/eas.json` con `development`, `preview` y `production` |
| El prebuild corre limpio | `npx expo prebuild --platform ios` genera el proyecto sin errores |
| Registro en la app | `movil/src/app/registro.tsx`, con el aviso de confirmación por email |
| Onboarding de usuario nuevo | El primer ingreso crea el hogar + 15 categorías (verificado: exactamente uno, sin duplicados por llamadas concurrentes) |
| Demo protegida | La cuenta de demo no se puede borrar (guarda server-side en `lib/datos/borrar-cuenta.ts`) |

---

## Auditoría pre-envío (QA del 2026-07-28)

Recorrido completo con el ojo de App Review. Cada punto se verificó contra el
código o en el simulador — no es una lista de deseos, es lo que se comprobó.

### Guidelines que aplican, y cómo estamos

| Guideline | Qué mira Apple | Estado |
|---|---|---|
| **2.1 Completeness** | Que la app esté completa, sin crashes ni placeholders, y que el reviewer pueda probarla | ✅ Recorrido entero sin crashes. Usuario nuevo aterriza en un Resumen funcional con CTA de armar presupuesto. Una sesión huérfana (cuenta borrada desde otro lado) degrada sin romper. El botón de demo le da al reviewer una cuenta con datos sin fricción |
| **2.3 Metadata** | Que la ficha describa lo que la app hace | ⏳ Externa: se escribe en App Store Connect (ver §5). Capturas SIN el botón de Expo Go |
| **4.8 Login services** | Si hay login de terceros (Google, Facebook), exige Sign in with Apple | ✅ No aplica: la app nativa solo tiene email+contraseña y demo. ⚠️ Si algún día se agrega "Continuar con Google" al iOS, ese día se vuelve OBLIGATORIO agregar Sign in with Apple |
| **5.1.1(v) Account deletion** | Borrar la cuenta DESDE la app, no por mail | ✅ En Hogar, en las dos apps. Probado end-to-end (`pnpm prueba:borrado`, 14 aserciones) |
| **5.1.1 Data collection** | Política de privacidad accesible + pedir solo lo necesario | ✅ `/privacidad` pública sin login, linkeada desde el login y Hogar. Sin trackers, sin analítica, sin ATT |
| **5.1.2 Data use** | Que los datos no se compartan sin decirlo | ✅ La política declara Supabase/Vercel como infraestructura y qué viaja a Anthropic al usar el asistente |
| **1.2 / IA generativa** | Contenido generado con moderación y descargo | ✅ Descargo fijo en el chat ("no es asesoramiento financiero profesional") + límites duros en el system prompt (no recomienda instrumentos, deriva a asesor CNV) |
| **2.5.4 / background** | Modos de background que no se usan | ✅ Ninguno declarado. Avisos = notificaciones LOCALES, sin push remoto ni entitlement de aps |
| **Export compliance** | Cifrado | ✅ `usesNonExemptEncryption: false` (solo HTTPS estándar) |
| **Privacy manifests** | Required-Reason APIs de los SDKs | ✅ Los pods de Expo SDK 57 / RN traen sus `PrivacyInfo.xcprivacy`; no hay SDKs de terceros fuera de eso |
| **App icon** | 1024 sin canal alfa | ✅ Verificado en el prebuild: `hasAlpha: no` |
| **ATS** | Nada de HTTP plano | ✅ Todos los endpoints de build son HTTPS (`eas.json`); `http://localhost` solo existe en desarrollo |
| **iPad** | Si no es universal, que escale bien | ✅ `supportsTablet: false` → corre en modo iPhone escalado, aceptado por revisión |

### Cuestionario App Privacy (respuestas para cargar tal cual)

| Dato | ¿Se recolecta? | ¿Vinculado al usuario? | ¿Tracking? |
|---|---|---|---|
| Email | Sí (cuenta) | Sí | No |
| Información financiera | Sí (lo que cargás) | Sí | No |
| Nombre | Sí (nombre en el hogar) | Sí | No |
| Identificadores, ubicación, contactos, fotos, salud, analítica | No | — | — |

### Hallazgos del QA (ya corregidos en este commit)

1. **No había registro en la app iOS** — un usuario nuevo no podía crear
   cuenta. Riesgo directo de rechazo por 2.1. → `registro.tsx` + link en el
   login + ruta pública en el Portero.
2. **El primer ingreso quedaba roto**: el `obtenerSesionHogar` nativo devolvía
   `null` para un usuario sin hogar (la web lo bootstrapea, la app no). El
   reviewer que creara una cuenta veía una app vacía sin salida. → Se portó el
   bootstrap (RPC `crear_hogar` + categorías), con deduplicación de llamadas
   concurrentes para no crear dos hogares en el primer render.
3. **Cualquier visitante de la demo podía borrar la cuenta de demo** (el botón
   del login le da una sesión real a cualquiera, y el borrado nuevo llegaba
   hasta `auth.users`: la demo moría para siempre). → Guarda server-side por
   `DEMO_EMAIL`; probado con el token de demo, responde "la cuenta de demo es
   compartida y no se puede borrar" y el hogar Coghlan queda intacto.
4. **`pnpm rls:check` crasheaba** contra producción porque la migración de
   Gmail está dormida (tablas ausentes). → La sección de Gmail se saltea con
   aviso; el resto corre entero: cero filtraciones.
5. **`.env.example` publicaba la contraseña real de la demo** en un
   comentario. → Placeholder. (La misma clave sigue en `scripts/seed.ts`
   porque el seed la necesita; la demo es compartida por diseño, pero si algún
   día importa, rotarla.)

### Nota de Supabase que va a doler en el registro real

El signUp con confirmación por email usa el mailer built-in de Supabase, que
permite **~2 mails por hora**. Para la revisión de Apple alcanza (el reviewer
usa la demo), pero el primer día con usuarios reales se traba. Antes del
launch: configurar SMTP propio (Resend) en Supabase → Auth → SMTP.

Detalle de comportamiento: registrarse con un email ya existente muestra el
mismo aviso de "revisá tu correo" — es la protección anti-enumeración de
Supabase (no revela si el email existe), no un bug. La web hace exactamente lo
mismo.

---

## 1. Antes de cualquier build

**Cargar las variables de entorno en EAS.** `movil/.env` está gitignoreado, así
que las builds en la nube no lo ven. Hay tres:

```bash
cd movil
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "..." --environment production
eas env:create --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value "..." --environment production
```

`EXPO_PUBLIC_API_URL` ya está en `eas.json` porque no es secreto. La
publishable key tampoco es secreta —es la que protege RLS— pero conviene que no
viva en el repo.

---

## 2. Cuenta de desarrollador (USD 99/año)

Se saca en [developer.apple.com/programs](https://developer.apple.com/programs/).
Con DNI/pasaporte si la sacás como persona física; si la sacás como empresa
piden el número D-U-N-S y tarda bastante más. Para esta app, persona física
alcanza.

La aprobación suele tardar entre unas horas y dos días.

---

## 3. Primer build de desarrollo

Esto no es opcional: **hay una cosa que no se pudo verificar en Expo Go**.

> Face ID no funciona en Expo Go en iOS — es una limitación documentada del SDK
> 57, no un bug nuestro. El código de [`movil/src/lib/bloqueo.tsx`](../movil/src/lib/bloqueo.tsx)
> está escrito y tipa, pero el camino "se cierra sola → pide la cara → vuelve"
> solo se puede probar en un development build.

```bash
cd movil
eas build --profile development --platform ios
```

Al correrlo por primera vez, EAS pide entrar con el Apple ID y crea solo el
certificado y el perfil. Instalás el `.app` resultante en el simulador (o el
`.ipa` en tu iPhone) y ahí sí:

- [ ] Prender "Pedir Face ID al abrir" en Hogar
- [ ] Mandar la app a segundo plano más de 30 segundos y volver → tiene que
      taparse y pedir la cara
- [ ] Apagar el bloqueo → tiene que pedir la cara para dejarte apagarlo
- [ ] Cargar un gasto en un **iPhone de verdad** y sentir el háptico (el
      simulador no tiene motor háptico: ahí no se siente nada aunque el código
      corra)

---

## 4. Capturas de pantalla

App Store Connect pide, como mínimo, capturas de un iPhone de 6.9" (los Pro Max
/ Air actuales). Las cinco que cuentan la historia de la app:

1. **Resumen** — el disponible del mes, grande. Es el argumento de venta.
2. **Presupuesto** — las partidas con sus barras; se entiende el método de
   sobres sin leer nada.
3. **Detalle de tarjeta** — los ciclos con cierre y vencimiento reales. Esto es
   lo que las apps genéricas no hacen bien en Argentina.
4. **Movimientos** — con el swipe abierto, para que se vea que es táctil.
5. **Asistente** — una respuesta con números reales.

Se sacan del simulador con la app corriendo. Ojo: **el botón azul flotante de
Expo Go aparece en las capturas** — hay que sacarlas desde el development
build, no desde Expo Go.

---

## 5. Ficha en App Store Connect

- **Nombre**: Fin de mes
- **Subtítulo** (30 caracteres): `Presupuesto y tarjetas` (22)
- **Categoría**: Finanzas
- **Idioma principal**: Español (México) o Español (España) — App Store Connect
  no tiene es-AR; el binario sí declara es-AR.
- **Privacidad**: URL `https://pfm-mu.vercel.app/privacidad`
- **Soporte**: URL o mail. Vale `contacto@juansebarrio.com`.

### Cuestionario de privacidad (App Privacy)

Lo que hay que declarar, en base a lo que la app realmente hace:

| Dato | ¿Se recolecta? | Vinculado a vos | Para rastrear |
|---|---|---|---|
| Email | Sí — identificador de cuenta | Sí | No |
| Información financiera | Sí — lo que cargás | Sí | No |
| Nombre | Sí — el nombre en el hogar | Sí | No |
| Identificadores de dispositivo | No | — | — |
| Ubicación, contactos, salud, fotos | No | — | — |
| Datos de uso / analítica | No | — | — |

En "Tracking" va **no**: no hay SDK de terceros ni publicidad, así que tampoco
hace falta pedir permiso de App Tracking Transparency.

---

## 6. Lo que Apple va a mirar de cerca

Las apps de finanzas reciben más escrutinio. Los tres puntos donde suele
trabarse:

1. **Cuenta de demo.** La guía 2.1 pide credenciales para poder probar la app.
   Hay que darles un usuario con datos cargados — el mismo del seed sirve — en
   las "App Review Information". Sin esto es rechazo casi seguro: el revisor no
   se va a crear un hogar y cargar tres meses de gastos.

2. **El asistente con IA.** La guía 1.2 pide que el contenido generado se pueda
   reportar y que haya moderación. A favor nuestro: el asistente ya tiene
   límites duros en el prompt (nada de recomendar instrumentos puntuales,
   sugerir asesor matriculado ante la CNV) y la pantalla lleva el descargo
   "no es asesoramiento financiero profesional" fijo abajo. Si preguntan,
   señalar eso.

3. **Borrado de cuenta.** Desde 2022 es obligatorio que se pueda borrar la
   cuenta *desde la app*, no solo por mail (guía 5.1.1(v)). Ya está: abajo de
   todo en Hogar, en las dos apps. La regla es "lo tuyo se va, lo del hogar
   queda si el hogar sigue vivo" — si sos el único miembro se borra el hogar
   entero; si compartís, se borra lo personal y lo compartido se traspasa a
   quien queda, que además hereda el rol de administrador.

   Se prueba de punta a punta con usuarios descartables:

   ```bash
   pnpm prueba:borrado
   ```

---

## 7. Enviar

```bash
cd movil
eas build --profile production --platform ios
eas submit --profile production --platform ios
```

Después, en App Store Connect: TestFlight primero (probalo unos días con la app
instalada de verdad, usándola para tus gastos reales), y recién ahí "Enviar a
revisión".

La revisión suele tardar entre un día y tres días hábiles. Un rechazo no es
drama: casi siempre es la cuenta de demo o un texto de la ficha, se corrige y
se reenvía.

---

## Regenerar el proyecto nativo

`movil/ios/` no está en el repo a propósito: se genera de `app.json` cada vez
(*continuous native generation*). Si alguna vez hace falta mirarlo:

```bash
cd movil && npx expo prebuild --platform ios
```

Y para volver al modo de desarrollo normal (Expo Go, sin carpeta nativa), se
borra `movil/ios/` y listo.
