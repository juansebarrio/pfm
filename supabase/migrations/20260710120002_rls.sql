-- Sobres · RLS (tanda 2)
-- Patrón general: lectura = ser miembro del hogar Y (fila compartida O fila propia).
-- Las tablas sin visibilidad usan solo membresía; lo personal se filtra por dueño.
-- Escrituras con el mismo criterio; cada política lleva su comentario.

-- ------------------------------------------------------------ helpers

-- security definer para evitar recursión de RLS sobre miembros_hogar
create or replace function es_miembro(hogar uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from miembros_hogar
    where hogar_id = hogar and user_id = auth.uid()
  );
$$;

create or replace function es_administrador(hogar uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from miembros_hogar
    where hogar_id = hogar and user_id = auth.uid() and rol = 'administrador'
  );
$$;

revoke execute on function es_miembro(uuid), es_administrador(uuid) from anon;

-- ------------------------------------------------------------ hogares

alter table hogares enable row level security;

-- leer: solo hogares donde soy miembro
create policy hogares_select on hogares for select
  using (es_miembro(id));

-- crear: cualquiera autenticado crea su hogar (queda como creado_por)
create policy hogares_insert on hogares for insert
  with check (creado_por = (select auth.uid()));

-- editar (renombrar): solo administradores
create policy hogares_update on hogares for update
  using (es_administrador(id));

-- borrar hogares no se permite desde el cliente (sin policy de delete)

-- ------------------------------------------------------------ miembros_hogar

alter table miembros_hogar enable row level security;

-- leer: veo a los miembros de mis hogares
create policy miembros_select on miembros_hogar for select
  using (es_miembro(hogar_id));

-- alta: me agrego a mí mismo, y solo si soy el creador del hogar (bootstrap
-- del primer administrador). Las altas por invitación pasan por la función
-- security definer aceptar_invitacion(), no por acá.
create policy miembros_insert on miembros_hogar for insert
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from hogares h
      where h.id = hogar_id and h.creado_por = (select auth.uid())
    )
  );

-- editar (rol, nombre): administradores del hogar, o el propio miembro su nombre
create policy miembros_update on miembros_hogar for update
  using (es_administrador(hogar_id) or user_id = (select auth.uid()));

-- baja: un administrador saca miembros; cualquiera puede irse a sí mismo
create policy miembros_delete on miembros_hogar for delete
  using (es_administrador(hogar_id) or user_id = (select auth.uid()));

-- ------------------------------------------------------------ invitaciones

alter table invitaciones enable row level security;

-- leer: miembros del hogar (la persona invitada entra por token vía RPC)
create policy invitaciones_select on invitaciones for select
  using (es_miembro(hogar_id));

-- invitar: solo administradores
create policy invitaciones_insert on invitaciones for insert
  with check (es_administrador(hogar_id) and creada_por = (select auth.uid()));

-- reenviar / revocar (cambiar estado o vencimiento): solo administradores
create policy invitaciones_update on invitaciones for update
  using (es_administrador(hogar_id));

-- limpiar: solo administradores
create policy invitaciones_delete on invitaciones for delete
  using (es_administrador(hogar_id));

-- ------------------------------------------------------------ cuentas

alter table cuentas enable row level security;

-- leer: miembro Y (compartida O mía) — patrón general de visibilidad
create policy cuentas_select on cuentas for select
  using (
    es_miembro(hogar_id)
    and (visibilidad = 'compartido' or user_id = (select auth.uid()))
  );

-- crear: miembro del hogar, la cuenta nace a mi nombre
create policy cuentas_insert on cuentas for insert
  with check (es_miembro(hogar_id) and user_id = (select auth.uid()));

-- editar: lo compartido lo edita cualquier miembro; lo personal, su dueño
create policy cuentas_update on cuentas for update
  using (
    es_miembro(hogar_id)
    and (visibilidad = 'compartido' or user_id = (select auth.uid()))
  );

-- sin delete desde el cliente: las cuentas se desactivan (activa = false)

-- ------------------------------------------------------------ tarjetas

alter table tarjetas enable row level security;

-- mismas cuatro reglas que cuentas
create policy tarjetas_select on tarjetas for select
  using (
    es_miembro(hogar_id)
    and (visibilidad = 'compartido' or user_id = (select auth.uid()))
  );

create policy tarjetas_insert on tarjetas for insert
  with check (es_miembro(hogar_id) and user_id = (select auth.uid()));

create policy tarjetas_update on tarjetas for update
  using (
    es_miembro(hogar_id)
    and (visibilidad = 'compartido' or user_id = (select auth.uid()))
  );

-- ------------------------------------------------------------ ciclos_tarjeta

alter table ciclos_tarjeta enable row level security;

-- los ciclos heredan la visibilidad de su tarjeta
create policy ciclos_select on ciclos_tarjeta for select
  using (
    exists (
      select 1 from tarjetas t
      where t.id = tarjeta_id
        and es_miembro(t.hogar_id)
        and (t.visibilidad = 'compartido' or t.user_id = (select auth.uid()))
    )
  );

-- crear/editar ciclos: quien puede ver la tarjeta puede operar sus ciclos
create policy ciclos_insert on ciclos_tarjeta for insert
  with check (
    exists (
      select 1 from tarjetas t
      where t.id = tarjeta_id
        and es_miembro(t.hogar_id)
        and (t.visibilidad = 'compartido' or t.user_id = (select auth.uid()))
    )
  );

create policy ciclos_update on ciclos_tarjeta for update
  using (
    exists (
      select 1 from tarjetas t
      where t.id = tarjeta_id
        and es_miembro(t.hogar_id)
        and (t.visibilidad = 'compartido' or t.user_id = (select auth.uid()))
    )
  );

-- ------------------------------------------------------------ categorias

alter table categorias enable row level security;

-- hogar: las ven todos los miembros; personal: solo su dueño
create policy categorias_select on categorias for select
  using (
    es_miembro(hogar_id)
    and (ambito = 'hogar' or user_id = (select auth.uid()))
  );

-- crear: miembro; si es personal, a mi nombre
create policy categorias_insert on categorias for insert
  with check (
    es_miembro(hogar_id)
    and (ambito = 'hogar' or user_id = (select auth.uid()))
  );

-- editar: mismo criterio que leer
create policy categorias_update on categorias for update
  using (
    es_miembro(hogar_id)
    and (ambito = 'hogar' or user_id = (select auth.uid()))
  );

-- ------------------------------------------------------------ compras_en_cuotas

alter table compras_en_cuotas enable row level security;

-- patrón general de visibilidad
create policy compras_select on compras_en_cuotas for select
  using (
    es_miembro(hogar_id)
    and (visibilidad = 'compartido' or user_id = (select auth.uid()))
  );

create policy compras_insert on compras_en_cuotas for insert
  with check (es_miembro(hogar_id) and user_id = (select auth.uid()));

create policy compras_update on compras_en_cuotas for update
  using (
    es_miembro(hogar_id)
    and (visibilidad = 'compartido' or user_id = (select auth.uid()))
  );

-- borrar una compra borra sus cuotas hijas (on delete cascade)
create policy compras_delete on compras_en_cuotas for delete
  using (
    es_miembro(hogar_id)
    and (visibilidad = 'compartido' or user_id = (select auth.uid()))
  );

-- ------------------------------------------------------------ movimientos

alter table movimientos enable row level security;

-- el corazón del modelo de privacidad: miembro Y (compartido O propio).
-- Un miembro NO ve los movimientos personales de otro miembro de su hogar.
create policy movimientos_select on movimientos for select
  using (
    es_miembro(hogar_id)
    and (visibilidad = 'compartido' or user_id = (select auth.uid()))
  );

-- cargar: miembro del hogar, el movimiento nace a mi nombre
create policy movimientos_insert on movimientos for insert
  with check (es_miembro(hogar_id) and user_id = (select auth.uid()));

-- editar (recategorizar, corregir): compartido cualquiera del hogar; personal su dueño
create policy movimientos_update on movimientos for update
  using (
    es_miembro(hogar_id)
    and (visibilidad = 'compartido' or user_id = (select auth.uid()))
  );

create policy movimientos_delete on movimientos for delete
  using (
    es_miembro(hogar_id)
    and (visibilidad = 'compartido' or user_id = (select auth.uid()))
  );

-- ------------------------------------------------------------ presupuestos

alter table presupuestos enable row level security;

-- hogar: todos los miembros; personal: solo su dueño
create policy presupuestos_select on presupuestos for select
  using (
    es_miembro(hogar_id)
    and (ambito = 'hogar' or user_id = (select auth.uid()))
  );

create policy presupuestos_insert on presupuestos for insert
  with check (
    es_miembro(hogar_id)
    and (ambito = 'hogar' or user_id = (select auth.uid()))
  );

create policy presupuestos_update on presupuestos for update
  using (
    es_miembro(hogar_id)
    and (ambito = 'hogar' or user_id = (select auth.uid()))
  );

create policy presupuestos_delete on presupuestos for delete
  using (
    es_miembro(hogar_id)
    and (ambito = 'hogar' or user_id = (select auth.uid()))
  );

-- ------------------------------------------------------------ partidas_presupuesto

alter table partidas_presupuesto enable row level security;

-- heredan el permiso de su presupuesto (hogar o personal del dueño)
create policy partidas_select on partidas_presupuesto for select
  using (
    exists (
      select 1 from presupuestos p
      where p.id = presupuesto_id
        and es_miembro(p.hogar_id)
        and (p.ambito = 'hogar' or p.user_id = (select auth.uid()))
    )
  );

create policy partidas_insert on partidas_presupuesto for insert
  with check (
    exists (
      select 1 from presupuestos p
      where p.id = presupuesto_id
        and es_miembro(p.hogar_id)
        and (p.ambito = 'hogar' or p.user_id = (select auth.uid()))
    )
  );

create policy partidas_update on partidas_presupuesto for update
  using (
    exists (
      select 1 from presupuestos p
      where p.id = presupuesto_id
        and es_miembro(p.hogar_id)
        and (p.ambito = 'hogar' or p.user_id = (select auth.uid()))
    )
  );

create policy partidas_delete on partidas_presupuesto for delete
  using (
    exists (
      select 1 from presupuestos p
      where p.id = presupuesto_id
        and es_miembro(p.hogar_id)
        and (p.ambito = 'hogar' or p.user_id = (select auth.uid()))
    )
  );

-- ------------------------------------------------------------ recurrentes

alter table recurrentes enable row level security;

-- patrón general de visibilidad
create policy recurrentes_select on recurrentes for select
  using (
    es_miembro(hogar_id)
    and (visibilidad = 'compartido' or user_id = (select auth.uid()))
  );

create policy recurrentes_insert on recurrentes for insert
  with check (es_miembro(hogar_id) and user_id = (select auth.uid()));

create policy recurrentes_update on recurrentes for update
  using (
    es_miembro(hogar_id)
    and (visibilidad = 'compartido' or user_id = (select auth.uid()))
  );

create policy recurrentes_delete on recurrentes for delete
  using (
    es_miembro(hogar_id)
    and (visibilidad = 'compartido' or user_id = (select auth.uid()))
  );

-- ------------------------------------------------------------ tenencias

alter table tenencias enable row level security;

-- patrón general de visibilidad
create policy tenencias_select on tenencias for select
  using (
    es_miembro(hogar_id)
    and (visibilidad = 'compartido' or user_id = (select auth.uid()))
  );

create policy tenencias_insert on tenencias for insert
  with check (es_miembro(hogar_id) and user_id = (select auth.uid()));

create policy tenencias_update on tenencias for update
  using (
    es_miembro(hogar_id)
    and (visibilidad = 'compartido' or user_id = (select auth.uid()))
  );

-- sin delete: las tenencias se desactivan (activa = false)

-- ------------------------------------------------------------ snapshots_patrimonio

alter table snapshots_patrimonio enable row level security;

-- foto agregada del hogar: solo membresía (sin visibilidad por fila)
create policy snapshots_select on snapshots_patrimonio for select
  using (es_miembro(hogar_id));

create policy snapshots_insert on snapshots_patrimonio for insert
  with check (es_miembro(hogar_id));

create policy snapshots_update on snapshots_patrimonio for update
  using (es_miembro(hogar_id));

create policy snapshots_delete on snapshots_patrimonio for delete
  using (es_miembro(hogar_id));

-- ------------------------------------------------------------ tipos_cambio

alter table tipos_cambio enable row level security;

-- TC del hogar: solo membresía
create policy tc_select on tipos_cambio for select
  using (es_miembro(hogar_id));

create policy tc_insert on tipos_cambio for insert
  with check (es_miembro(hogar_id));

create policy tc_update on tipos_cambio for update
  using (es_miembro(hogar_id));

create policy tc_delete on tipos_cambio for delete
  using (es_miembro(hogar_id));
