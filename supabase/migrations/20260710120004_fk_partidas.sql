-- Una partida no existe sin su categoría. Además, sin cascade el borrado de un
-- hogar se traba: la cascada hogares→categorias corre antes que la de
-- hogares→presupuestos→partidas y la FK sin acción corta el camino.
alter table partidas_presupuesto
  drop constraint partidas_presupuesto_categoria_id_fkey,
  add constraint partidas_presupuesto_categoria_id_fkey
    foreign key (categoria_id) references categorias (id) on delete cascade;
