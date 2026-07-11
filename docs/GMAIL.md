# Conectar Google (login + sugerencias desde Gmail)

Fin de mes puede: (1) dejar entrar con **"Continuar con Google"**, y (2) leer
los **últimos 50 mails** de la casilla conectada para convertir avisos de
consumo (Mercado Pago, BBVA, Galicia, etc.) en **sugerencias de movimientos**.
Nada entra al presupuesto sin confirmación; el scope es `gmail.readonly`
(la app no puede escribir ni borrar correo).

El código ya está deployado pero **oculto** hasta setear `NEXT_PUBLIC_GOOGLE=true`.
Para activarlo hay ~10 minutos de configuración manual:

## 1. Proyecto en Google Cloud

1. Entrá a [console.cloud.google.com](https://console.cloud.google.com) → crear proyecto (ej. "Fin de mes").
2. **APIs y servicios → Biblioteca** → buscar **Gmail API** → *Habilitar*.
3. **APIs y servicios → Pantalla de consentimiento OAuth**:
   - Tipo **Externo**, completá nombre y mail de soporte.
   - **Público (Testing)**: dejá la app en *Testing* y agregá como *test users*
     tu Gmail y el de Vale. ⚠️ En modo Testing los refresh tokens **vencen a
     los 7 días**: la card de Gmail va a pedir reconectar una vez por semana.
     Publicar la app eliminaría ese límite, pero el scope de Gmail es
     "restringido" y Google exige una auditoría de seguridad paga (CASA) —
     no tiene sentido para uso personal.
   - Scopes: agregá `.../auth/gmail.readonly` (además de email/profile).
4. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente OAuth**:
   - Tipo: **Aplicación web**.
   - **URIs de redirección autorizados** (los DOS):
     - `https://<TU-PROYECTO>.supabase.co/auth/v1/callback`
     - (el dominio exacto está en Supabase → Authentication → Providers → Google, campo "Callback URL")
   - Guardá el **Client ID** y el **Client Secret**.

## 2. Provider de Google en Supabase

1. Dashboard de Supabase → **Authentication → Sign In / Up → Google** → Enable.
2. Pegá el Client ID y el Client Secret del paso anterior.
3. **Authentication → URL Configuration → Redirect URLs**: agregá
   - `http://localhost:3000/auth/callback`
   - `https://pfm-mu.vercel.app/auth/callback`

## 3. Variables de entorno

En `.env.local` (dev) y en Vercel (producción):

```
NEXT_PUBLIC_GOOGLE=true
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GMAIL_TOKEN_KEY=<openssl rand -base64 32>   # ya generada en .env.local
```

`NEXT_PUBLIC_APP_URL` debe apuntar al dominio correcto en cada entorno
(en producción: `https://pfm-mu.vercel.app`), porque arma el redirect del OAuth.

## Cómo funciona por dentro

- **Login**: `signInWithOAuth` con scopes básicos → `/auth/callback` canjea el
  código por la sesión. Si el mail de Google coincide con una cuenta de
  email+contraseña verificada, Supabase las vincula (una sola cuenta).
- **Conectar Gmail** (card en /cuentas): mismo flujo pero pide
  `gmail.readonly` + `access_type=offline` + `prompt=consent`; el refresh
  token se guarda **cifrado** (AES-256-GCM, `GMAIL_TOKEN_KEY`) en
  `conexiones_gmail`. La columna del token tiene el SELECT revocado para
  `authenticated`: solo el servidor la lee con la secret key.
- **Buscar movimientos**: baja los últimos 50 mails, el parser
  (`lib/dominio/correo.ts`) detecta transacciones (frase transaccional +
  importe ARS; el marketing se filtra) y crea filas en `sugerencias_correo`
  (dedup por `gmail_id`). Las sugerencias son **personales** (RLS por
  usuario): el resto del hogar no ve lo que llega a tu casilla.
- **Aceptar** crea el movimiento con la fecha del mail (ciclo de tarjeta
  incluido si los últimos 4 matchean una tarjeta del hogar). **Descartar**
  registra el mail para no volver a sugerirlo.

## Limitaciones conocidas (MVP)

- Solo importes en **pesos** (los consumos en USD se ignoran, tanto por símbolo
  U$S/USD como por la moneda declarada antes o después del monto).
- Compras en cuotas anunciadas por mail entran como gasto simple (sin plan de cuotas).
- La conexión es del usuario: cada miembro conecta su propia casilla.
- "Conectar Gmail" reabre el consentimiento de Google con la MISMA cuenta del
  login (se pasa `login_hint`); si elegís otra cuenta de Google ahí, la sesión
  pasa a ser de esa otra cuenta.
- **Fecha vieja → ciclo ya cerrado**: al aceptar una sugerencia de tarjeta, el
  gasto se asigna al ciclo que corresponde a la fecha del mail. Si esa fecha cae
  en un ciclo ya cerrado y conciliado (p. ej. sincronizás por primera vez mails
  de meses atrás), el gasto entra igual en ese ciclo y su detalle deja de cuadrar
  con el total conciliado. En la práctica los avisos de consumo llegan el día de
  la compra, así que solo pasa al conectar una casilla con avisos viejos.
- **Misma casilla en dos miembros**: si dos miembros del hogar conectan la MISMA
  casilla de Gmail, el mismo mail genera una sugerencia para cada uno (el dedup
  es por `user_id + gmail_id`) y ambos podrían aceptarla → gasto duplicado. Lo
  normal es que cada uno conecte su propia casilla.
- El parser es heurístico: puede no detectar formatos de banco raros (falso
  negativo) o extraer un comercio impreciso. Nada se guarda como movimiento sin
  que lo revises y confirmes.
