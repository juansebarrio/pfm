-- Sobres · Funciones RPC (tanda 2)
-- Flujos multi-paso que no pueden expresarse con policies sueltas.

-- Crea el hogar y da de alta al creador como administrador, en una transacción.
create or replace function crear_hogar(nombre_hogar text, nombre_miembro text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nuevo_hogar uuid;
begin
  if auth.uid() is null then
    raise exception 'no autenticado';
  end if;

  insert into hogares (nombre, creado_por)
  values (nombre_hogar, auth.uid())
  returning id into nuevo_hogar;

  insert into miembros_hogar (user_id, hogar_id, rol, nombre)
  values (auth.uid(), nuevo_hogar, 'administrador', nombre_miembro);

  return nuevo_hogar;
end;
$$;

-- Acepta una invitación por token: valida estado y vencimiento, da de alta
-- al usuario autenticado con el rol invitado y marca la invitación aceptada.
-- No exige que el email coincida: el token es el secreto (quien lo tiene,
-- entra), igual que el link "se muestra para copiar" del flujo sin Resend.
create or replace function aceptar_invitacion(token_invitacion text, nombre_miembro text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
begin
  if auth.uid() is null then
    raise exception 'no autenticado';
  end if;

  select * into inv
  from invitaciones
  where token = token_invitacion
  for update;

  if not found then
    raise exception 'invitacion inexistente';
  end if;

  if inv.estado <> 'pendiente' then
    raise exception 'invitacion no pendiente';
  end if;

  if inv.vence_el < now() then
    update invitaciones set estado = 'vencida' where id = inv.id;
    raise exception 'invitacion vencida';
  end if;

  if exists (
    select 1 from miembros_hogar
    where hogar_id = inv.hogar_id and user_id = auth.uid()
  ) then
    raise exception 'ya sos miembro de este hogar';
  end if;

  insert into miembros_hogar (user_id, hogar_id, rol, nombre)
  values (auth.uid(), inv.hogar_id, inv.rol, nombre_miembro);

  update invitaciones set estado = 'aceptada' where id = inv.id;

  return inv.hogar_id;
end;
$$;

-- Lee los datos públicos de una invitación por token (para la pantalla
-- /invitacion/[token] antes de registrarse). Solo expone lo mínimo.
create or replace function leer_invitacion(token_invitacion text)
returns table (hogar_nombre text, email text, estado estado_invitacion, vence_el timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select h.nombre, i.email, i.estado, i.vence_el
  from invitaciones i
  join hogares h on h.id = i.hogar_id
  where i.token = token_invitacion;
$$;

-- Reasigna al ciclo correcto los consumos de una tarjeta.
-- Regla: un consumo cae en el ciclo abierto/futuro más cercano cuyo
-- fecha_cierre >= fecha del consumo (y posterior al cierre del ciclo previo).
-- Se ejecuta cuando se corrige una fecha de cierre (tanda 5).
create or replace function reasignar_consumos_tarjeta(tarjeta uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  afectados int;
begin
  -- el que llama tiene que poder ver la tarjeta (mismo criterio que RLS)
  if not exists (
    select 1 from tarjetas t
    where t.id = tarjeta
      and es_miembro(t.hogar_id)
      and (t.visibilidad = 'compartido' or t.user_id = auth.uid())
  ) then
    raise exception 'tarjeta inexistente o sin permiso';
  end if;

  with ciclo_correcto as (
    select m.id as movimiento_id,
      (
        select c.id from ciclos_tarjeta c
        where c.tarjeta_id = tarjeta
          and c.fecha_cierre >= m.fecha
        order by c.fecha_cierre asc
        limit 1
      ) as ciclo_nuevo
    from movimientos m
    where m.tarjeta_id = tarjeta and m.tipo = 'gasto'
  )
  update movimientos m
  set ciclo_id = cc.ciclo_nuevo
  from ciclo_correcto cc
  where m.id = cc.movimiento_id
    and m.ciclo_id is distinct from cc.ciclo_nuevo
    and cc.ciclo_nuevo is not null;

  get diagnostics afectados = row_count;
  return afectados;
end;
$$;

revoke execute on function crear_hogar(text, text), aceptar_invitacion(text, text),
  leer_invitacion(text), reasignar_consumos_tarjeta(uuid) from anon;
