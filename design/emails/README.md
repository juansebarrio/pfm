# Mails transaccionales — Resend + Supabase

Cómo dejar el mail de alta (y todo lo demás) andando en serio. El código de
invitaciones ya habla con Resend (`lib/envio/invitaciones.ts`); lo que falta es
configuración en Resend, Supabase y Vercel — pasos de dashboard, con
credenciales, así que van a mano.

## 1. Resend

1. Crear cuenta en https://resend.com (con contacto@juansebarrio.com).
2. **Domains → Add domain** → `findemes.juansebarrio.com` (subdominio: no toca
   el mail personal de juansebarrio.com y aísla la reputación).
3. Resend te da 3 registros DNS (2 TXT para SPF/DKIM y 1 MX de bounces, todos
   sobre el subdominio). Agregalos donde esté la zona DNS de juansebarrio.com.
   Verificación: minutos, a veces un rato más.
4. **API Keys → Create** con permiso "Sending access". Se copia UNA vez.

## 2. Supabase (mails de auth: confirmación de alta, reset)

Dashboard del proyecto → **Authentication → SMTP Settings** (u "Emails"):

- Enable Custom SMTP ✔
- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: la API key de Resend
- Sender email: `cuentas@findemes.juansebarrio.com`
- Sender name: `Fin de mes`

Después, en **Authentication → Email Templates**, pegar las plantillas de esta
carpeta:

- `confirmacion.html` → plantilla **Confirm signup**
  (asunto: `Confirmá tu cuenta en Fin de mes`)
- `reset.html` → plantilla **Reset password**
  (asunto: `Tu clave de Fin de mes`)

En **Authentication → Rate Limits**, con SMTP propio conviene subir el límite
de emails (el default del SMTP compartido es 2 por hora).

## 3. Vercel (invitaciones al hogar)

Settings → Environment Variables (Production):

- `RESEND_API_KEY` = la misma API key
- `RESEND_FROM` = `Fin de mes <invitaciones@findemes.juansebarrio.com>`

Y redeploy. En `.env.local` local NO hace falta: sin la variable, el flujo
loguea el link para copiar, que es lo cómodo en dev.

## 4. Probar

1. Registrarse en https://pfm-mu.vercel.app con una casilla real → tiene que
   llegar "Confirmá tu cuenta en Fin de mes" desde el subdominio.
2. Confirmar → entrar.
3. Desde Hogar, invitar a otra casilla → tiene que llegar la invitación.

Con eso, el riesgo de rechazo de App Review por el alta queda cerrado.
