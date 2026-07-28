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
| Perfiles de build | `movil/eas.json` con `development`, `preview` y `production` |
| El prebuild corre limpio | `npx expo prebuild --platform ios` genera el proyecto sin errores |

---

## 1. Antes de cualquier build

**Sacar el prellenado de credenciales.** En
[`movil/src/app/login.tsx`](../movil/src/app/login.tsx) el email y la
contraseña vienen puestos bajo `__DEV__` para poder tipear en el simulador (el
teclado del simulador no escribe la arroba). `__DEV__` es `false` en un build
de producción, así que técnicamente no se filtra — pero es una credencial real
en el código fuente y no tiene por qué seguir ahí.

```bash
grep -n "__DEV__" movil/src/app/login.tsx
```

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
