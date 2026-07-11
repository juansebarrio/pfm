-- Sobres · Fixes de seguridad (revisión adversarial)

-- 1) Auto-ascenso a administrador: la policy miembros_update no tenía WITH CHECK
--    restrictivo, así que un miembro podía cambiar su propio rol a administrador.
--    Un trigger impide cambiar el rol salvo que quien edita sea admin del hogar.
create or replace function proteger_rol_miembro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.rol is distinct from old.rol and not es_administrador(old.hogar_id) then
    raise exception 'solo un administrador puede cambiar roles';
  end if;
  -- tampoco se puede mover un miembro de hogar por update
  if new.hogar_id is distinct from old.hogar_id then
    raise exception 'no se puede mover un miembro de hogar';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_rol_miembro on miembros_hogar;
create trigger trg_proteger_rol_miembro
  before update on miembros_hogar
  for each row execute function proteger_rol_miembro();
