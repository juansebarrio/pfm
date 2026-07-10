-- Sobres · Esquema completo (tanda 2)
-- Dominio en español. Todos los importes en centavos, enteros (bigint).
-- Las fechas de negocio son date (sin hora); los cortes de mes y ciclo
-- se calculan siempre en America/Argentina/Buenos_Aires desde la app.

-- pgcrypto para gen_random_bytes (tokens de invitación)
create extension if not exists pgcrypto with schema extensions;

-- ============================================================ enums

create type rol_hogar as enum ('administrador', 'miembro');
create type estado_invitacion as enum ('pendiente', 'aceptada', 'vencida', 'revocada');
create type tipo_cuenta as enum ('efectivo', 'banco', 'billetera', 'inversion');
create type moneda as enum ('ARS', 'USD');
create type visibilidad as enum ('personal', 'compartido');
create type red_tarjeta as enum ('visa', 'mastercard', 'amex', 'otra');
create type estado_fechas_ciclo as enum ('estimado', 'confirmado');
create type estado_ciclo as enum ('abierto', 'cerrado', 'conciliado');
create type tipo_movimiento as enum ('gasto', 'ingreso', 'transferencia', 'pago_resumen');
create type ambito_presupuesto as enum ('hogar', 'personal');
create type fuente_tc as enum ('mep', 'blue', 'oficial');
create type instrumento_tenencia as enum (
  'dolar_billete', 'dolar_mep', 'fci_money_market', 'plazo_fijo',
  'cedears', 'cripto', 'cuenta_remunerada', 'otro'
);

-- ============================================================ hogares

create table hogares (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 1 and 80),
  creado_por uuid not null references auth.users (id),
  creado_el timestamptz not null default now()
);

create table miembros_hogar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  hogar_id uuid not null references hogares (id) on delete cascade,
  rol rol_hogar not null default 'miembro',
  nombre text not null check (char_length(nombre) between 1 and 60),
  descripcion text, -- "vos", "adulta del hogar"
  creado_el timestamptz not null default now(),
  unique (user_id, hogar_id)
);

create table invitaciones (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references hogares (id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  rol rol_hogar not null default 'miembro',
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  estado estado_invitacion not null default 'pendiente',
  vence_el timestamptz not null,
  creada_por uuid not null references auth.users (id),
  creado_el timestamptz not null default now()
);

-- ============================================================ cuentas y tarjetas

create table cuentas (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references hogares (id) on delete cascade,
  user_id uuid not null references auth.users (id), -- dueño
  nombre text not null,
  tipo tipo_cuenta not null,
  moneda moneda not null default 'ARS',
  visibilidad visibilidad not null default 'compartido',
  saldo_inicial_centavos bigint not null default 0,
  activa boolean not null default true,
  creado_el timestamptz not null default now()
);

create table tarjetas (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references hogares (id) on delete cascade,
  user_id uuid not null references auth.users (id), -- titular
  nombre text not null,
  banco text not null,
  red red_tarjeta not null,
  ultimos4 text not null check (ultimos4 ~ '^[0-9]{4}$'),
  visibilidad visibilidad not null default 'compartido',
  -- estimación editable de impuestos y cargos por resumen (tanda 5)
  impuestos_estimados_centavos bigint not null default 0 check (impuestos_estimados_centavos >= 0),
  activa boolean not null default true,
  creado_el timestamptz not null default now()
);

create table ciclos_tarjeta (
  id uuid primary key default gen_random_uuid(),
  tarjeta_id uuid not null references tarjetas (id) on delete cascade,
  fecha_cierre date not null,
  fecha_vencimiento date not null,
  estado_fechas estado_fechas_ciclo not null default 'estimado',
  estado estado_ciclo not null default 'abierto',
  total_real_centavos bigint check (total_real_centavos >= 0), -- se completa al conciliar
  creado_el timestamptz not null default now(),
  unique (tarjeta_id, fecha_cierre),
  check (fecha_vencimiento > fecha_cierre)
);

-- ============================================================ categorías

create table categorias (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references hogares (id) on delete cascade,
  -- dueño solo para categorías de ámbito personal
  user_id uuid references auth.users (id),
  grupo text not null, -- "Vivienda", "Comida", …
  nombre text not null,
  ambito ambito_presupuesto not null default 'hogar',
  orden int not null default 0,
  icono text not null default 'tag', -- nombre de ícono lucide
  creado_el timestamptz not null default now(),
  check (ambito = 'hogar' or user_id is not null)
);

-- ============================================================ compras en cuotas

create table compras_en_cuotas (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references hogares (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  tarjeta_id uuid not null references tarjetas (id),
  descripcion text not null,
  total_centavos bigint not null check (total_centavos > 0),
  n_cuotas int not null check (n_cuotas between 1 and 60),
  fecha date not null, -- fecha de la compra; las cuotas devengan el 1 de cada mes
  visibilidad visibilidad not null default 'compartido',
  creado_el timestamptz not null default now()
);

-- ============================================================ movimientos

create table movimientos (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references hogares (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  tipo tipo_movimiento not null,
  descripcion text not null, -- comercio o concepto: "Coto", "Transferencia recibida"
  importe_centavos bigint not null check (importe_centavos > 0),
  moneda moneda not null default 'ARS',
  fecha date not null,
  cuenta_id uuid references cuentas (id),
  cuenta_destino_id uuid references cuentas (id), -- solo transferencias
  tarjeta_id uuid references tarjetas (id),
  ciclo_id uuid references ciclos_tarjeta (id),
  categoria_id uuid references categorias (id),
  visibilidad visibilidad not null default 'compartido',
  compra_id uuid references compras_en_cuotas (id) on delete cascade,
  n_cuota int check (n_cuota > 0), -- índice de la cuota (hijo de compra_id)
  nota text,
  creado_el timestamptz not null default now(),
  -- Regla de medios por tipo:
  --  gasto/ingreso: cuenta O tarjeta, nunca ambas (ingreso solo cuenta)
  --  transferencia: de cuenta a cuenta
  --  pago_resumen: sale de una cuenta y apunta a una tarjeta/ciclo
  check (
    case tipo
      when 'gasto' then num_nonnulls(cuenta_id, tarjeta_id) = 1 and cuenta_destino_id is null
      when 'ingreso' then cuenta_id is not null and tarjeta_id is null and ciclo_id is null and cuenta_destino_id is null
      when 'transferencia' then cuenta_id is not null and cuenta_destino_id is not null
        and cuenta_destino_id <> cuenta_id and tarjeta_id is null and ciclo_id is null
      when 'pago_resumen' then cuenta_id is not null and tarjeta_id is not null and cuenta_destino_id is null
    end
  ),
  -- un ciclo solo tiene sentido con tarjeta
  check (ciclo_id is null or tarjeta_id is not null),
  -- las cuotas hijas llevan índice; sin compra no hay índice
  check ((compra_id is null) = (n_cuota is null))
);

create index movimientos_hogar_fecha on movimientos (hogar_id, fecha desc);
create index movimientos_ciclo on movimientos (ciclo_id) where ciclo_id is not null;
create index movimientos_categoria on movimientos (categoria_id) where categoria_id is not null;
create index movimientos_compra on movimientos (compra_id) where compra_id is not null;

-- ============================================================ presupuestos

create table presupuestos (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references hogares (id) on delete cascade,
  mes date not null check (extract(day from mes) = 1),
  ambito ambito_presupuesto not null default 'hogar',
  user_id uuid references auth.users (id), -- dueño si es personal
  estado text not null default 'activo' check (estado in ('borrador', 'activo', 'cerrado')),
  creado_el timestamptz not null default now(),
  check ((ambito = 'personal') = (user_id is not null))
);

-- un presupuesto de hogar por mes; uno personal por mes y usuario
create unique index presupuestos_unico_hogar on presupuestos (hogar_id, mes) where ambito = 'hogar';
create unique index presupuestos_unico_personal on presupuestos (hogar_id, mes, user_id) where ambito = 'personal';

create table partidas_presupuesto (
  id uuid primary key default gen_random_uuid(),
  presupuesto_id uuid not null references presupuestos (id) on delete cascade,
  categoria_id uuid not null references categorias (id),
  asignado_centavos bigint not null check (asignado_centavos >= 0),
  rollover boolean not null default false,
  activa boolean not null default true,
  fija boolean not null default false, -- "· fijo": alquiler, prepaga, etc.
  nota text, -- "desactivada este mes · la paga Vale"
  creado_el timestamptz not null default now(),
  unique (presupuesto_id, categoria_id)
);

-- ============================================================ recurrentes

create table recurrentes (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references hogares (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  descripcion text not null,
  categoria_id uuid references categorias (id),
  cuenta_id uuid references cuentas (id),
  tarjeta_id uuid references tarjetas (id),
  importe_sugerido_centavos bigint not null check (importe_sugerido_centavos > 0),
  dia_mes int not null check (dia_mes between 1 and 28),
  visibilidad visibilidad not null default 'compartido',
  activa boolean not null default true,
  creado_el timestamptz not null default now(),
  check (num_nonnulls(cuenta_id, tarjeta_id) <= 1)
);

-- ============================================================ patrimonio

create table tenencias (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references hogares (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  cuenta_id uuid references cuentas (id),
  instrumento instrumento_tenencia not null,
  nombre text not null, -- "Dólar MEP", "FCI money market"
  detalle text, -- "Mercado Pago + Galicia", "rinde diario"
  -- USD: cantidad en centavos de dólar, se convierte con el TC activo.
  -- ARS: valuacion_centavos manual con fecha.
  cantidad_usd_centavos bigint check (cantidad_usd_centavos > 0),
  valuacion_centavos bigint check (valuacion_centavos > 0),
  moneda moneda not null,
  fecha_valuacion date not null,
  visibilidad visibilidad not null default 'compartido',
  activa boolean not null default true,
  creado_el timestamptz not null default now(),
  check (
    (moneda = 'USD' and cantidad_usd_centavos is not null)
    or (moneda = 'ARS' and valuacion_centavos is not null)
  )
);

create table snapshots_patrimonio (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references hogares (id) on delete cascade,
  fecha date not null,
  total_ars_centavos bigint not null,
  total_usd_centavos bigint not null,
  detalle jsonb not null default '{}',
  creado_el timestamptz not null default now(),
  unique (hogar_id, fecha)
);

create table tipos_cambio (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references hogares (id) on delete cascade,
  fecha date not null,
  fuente fuente_tc not null,
  valor_centavos bigint not null check (valor_centavos > 0),
  creado_el timestamptz not null default now(),
  unique (hogar_id, fecha, fuente)
);
