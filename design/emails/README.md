# Mails transaccionales — Resend + Supabase

Cómo dejar el mail de alta (y todo lo demás) andando en serio. El código de
invitaciones ya habla con Resend (`lib/envio/invitaciones.ts`); lo que falta es
configuración en Resend, Supabase y Vercel — pasos de dashboard, con
credenciales, así que van a mano.

El dominio de la app es **pfm.js80.studio** (ya apunta a Vercel; la zona DNS
está en Porkbun). Los mails salen de ese mismo dominio.

## 1. Resend

1. Crear cuenta en https://resend.com (con contacto@juansebarrio.com).
2. **Domains → Add domain** → `pfm.js80.studio`.
3. Resend te da 3 registros DNS. Cargarlos en **Porkbun → js80.studio → DNS**:
   - TXT de SPF sobre `send.pfm` (Porkbun agrega `.js80.studio` solo)
   - TXT de DKIM sobre `resend._domainkey.pfm`
   - MX de rebotes sobre `send.pfm`
   (los nombres exactos los muestra Resend; en Porkbun va el nombre SIN
   `.js80.studio` al final). Verificación: minutos, a veces un rato más.
4. **API Keys → Create** con permiso "Sending access". Se copia UNA vez.

## 2. Supabase (mails de auth: confirmación de alta, reset)

Dashboard del proyecto → **Authentication → SMTP Settings** (u "Emails"):

- Enable Custom SMTP ✔
- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: la API key de Resend
- Sender email: `cuentas@pfm.js80.studio`
- Sender name: `Fin de mes`

Después, en **Authentication → Email Templates**, pegar las plantillas de esta
carpeta:

- `confirmacion.html` → plantilla **Confirm signup**
  (asunto: `Confirmá tu cuenta en Fin de mes`)
- `reset.html` → plantilla **Reset password**
  (asunto: `Tu clave de Fin de mes`)

En **Authentication → Rate Limits**, con SMTP propio conviene subir el límite
de emails (el default del SMTP compartido es 2 por hora).

En **Authentication → URL Configuration**, revisar que la **Site URL** sea
`https://pfm.js80.studio` y que las Redirect URLs incluyan
`https://pfm.js80.studio/**` (si quedó la de pfm-mu.vercel.app, dejarla
también: no molesta).

## 3. Vercel

Settings → Environment Variables (Production):

- `RESEND_API_KEY` = la API key de Resend
- `RESEND_FROM` = `Fin de mes <invitaciones@pfm.js80.studio>`
- `NEXT_PUBLIC_APP_URL` = `https://pfm.js80.studio` (la usan los links de
  invitación y el callback de Google — revisar que no haya quedado la URL
  vieja de vercel.app)

Y redeploy. En `.env.local` local NO hace falta nada: sin RESEND_API_KEY, el
flujo loguea el link para copiar, que es lo cómodo en dev.

## 4. Probar

1. Registrarse en https://pfm.js80.studio con una casilla real → tiene que
   llegar "Confirmá tu cuenta en Fin de mes" desde @pfm.js80.studio.
2. Confirmar → entrar.
3. Desde Hogar, invitar a otra casilla → tiene que llegar la invitación.

Con eso, el riesgo de rechazo de App Review por el alta queda cerrado.
