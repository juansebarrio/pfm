-- Fin de mes · Conexión Gmail (opción A): login con Google + lectura de los
-- últimos mails para sugerir movimientos. Dos tablas nuevas, ambas PERSONALES
-- (RLS por user_id, no por hogar): el correo es del usuario, no del hogar.

-- ------------------------------------------------------------ conexiones_gmail
-- Una conexión por usuario. El refresh token de Google se guarda CIFRADO
-- (AES-256-GCM con GMAIL_TOKEN_KEY, solo servidor) y además la columna queda
-- sin SELECT para authenticated: ni el propio dueño puede leerla vía PostgREST.
-- La lee únicamente el servidor con la secret key durante la sincronización.

create table conexiones_gmail (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  email_gmail text not null,
  refresh_token_cifrado text not null,
  ultima_sincronizacion timestamptz,
  creado_el timestamptz not null default now()
);

alter table conexiones_gmail enable row level security;

-- cada usuario ve/gestiona SOLO su conexión
create policy conexiones_gmail_select on conexiones_gmail for select
  using (user_id = (select auth.uid()));
create policy conexiones_gmail_insert on conexiones_gmail for insert
  with check (user_id = (select auth.uid()));
create policy conexiones_gmail_update on conexiones_gmail for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy conexiones_gmail_delete on conexiones_gmail for delete
  using (user_id = (select auth.uid()));

-- El token cifrado no se puede LEER desde el cliente. OJO: un revoke a NIVEL
-- COLUMNA no sirve si el rol tiene select a nivel TABLA (en Postgres el permiso
-- es un OR), y Supabase concede select de tabla a authenticated/anon por default.
-- Por eso se revoca el select de la TABLA y se re-concede columna por columna,
-- todas menos refresh_token_cifrado. Los selects del cliente ya listan columnas
-- (nunca `*`) y el upsert del callback no necesita leer la columna.
revoke select on conexiones_gmail from authenticated, anon;
grant select (id, user_id, email_gmail, ultima_sincronizacion, creado_el)
  on conexiones_gmail to authenticated;

-- ------------------------------------------------------------ sugerencias_correo
-- Cada mail que parece una transacción se convierte en una sugerencia. Nunca
-- entra sola al presupuesto: el usuario la acepta (crea el movimiento) o la
-- descarta. gmail_id único por usuario = un mail nunca se sugiere dos veces,
-- ni siquiera después de descartado.

create table sugerencias_correo (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references hogares (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  gmail_id text not null,
  remitente text not null,
  asunto text not null default '',
  fecha date not null,
  tipo text not null check (tipo in ('gasto', 'ingreso')),
  importe_centavos bigint not null check (importe_centavos > 0),
  comercio text,
  ultimos4 text check (ultimos4 is null or ultimos4 ~ '^[0-9]{4}$'),
  -- tarjeta detectada por los últimos 4 dígitos, si coincide con una del hogar
  tarjeta_id uuid references tarjetas (id) on delete set null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aceptada', 'descartada')),
  -- el movimiento creado al aceptar; si se borra, la sugerencia queda aceptada
  movimiento_id uuid references movimientos (id) on delete set null,
  creado_el timestamptz not null default now(),
  unique (user_id, gmail_id)
);

create index sugerencias_correo_pendientes
  on sugerencias_correo (user_id, estado);

alter table sugerencias_correo enable row level security;

-- personales: cada usuario ve y gestiona solo SUS sugerencias (privacidad del
-- correo: el resto del hogar no ve lo que llega a tu casilla)
create policy sugerencias_select on sugerencias_correo for select
  using (user_id = (select auth.uid()));
create policy sugerencias_insert on sugerencias_correo for insert
  with check (user_id = (select auth.uid()) and es_miembro(hogar_id));
create policy sugerencias_update on sugerencias_correo for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy sugerencias_delete on sugerencias_correo for delete
  using (user_id = (select auth.uid()));
