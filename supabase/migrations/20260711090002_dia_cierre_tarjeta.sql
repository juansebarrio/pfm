-- Día de cierre/vencimiento nominal de la tarjeta, para poder generar el primer
-- ciclo estimado al darla de alta (antes no había forma de crear ciclos y una
-- tarjeta nueva quedaba sin ninguno). Nullable: las tarjetas del seed ya traen
-- sus ciclos y no lo necesitan.
alter table tarjetas
  add column dia_cierre int check (dia_cierre between 1 and 28),
  add column dia_vencimiento int check (dia_vencimiento between 1 and 28);
