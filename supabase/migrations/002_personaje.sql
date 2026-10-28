-- NEXUS · 002 · Personaje, monedas y tienda
-- Las monedas no se guardan como saldo editable: se calculan en el servidor a partir
-- de lo que el usuario no puede falsear (nivel por XP, meses ganados, logros de grupo)
-- más los logros del juego (lista cerrada de 8), menos lo gastado en la tienda.

begin;

alter table profiles add column if not exists avatar jsonb;
alter table profiles add column if not exists coins_spent int not null default 0;

create table if not exists shop_items(
  id text primary key,
  slot text not null check (slot in ('cabeza','torso','brazos','piernas','pies','hombros','arma','escudo')),
  name text not null,
  price int not null check (price >= 0),
  min_level int not null default 1,
  sort int not null default 0
);
create table if not exists owned_items(
  user_id uuid not null references profiles(id) on delete cascade,
  item_id text not null references shop_items(id),
  bought_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table shop_items enable row level security;
alter table owned_items enable row level security;
drop policy if exists shop_select on shop_items;
create policy shop_select on shop_items for select to authenticated using (true);
drop policy if exists owned_select on owned_items;
create policy owned_select on owned_items for select to authenticated using (shares_group(user_id));
revoke insert, update, delete on shop_items, owned_items from anon, authenticated;

insert into shop_items(id, slot, name, price, min_level, sort) values
  ('torso_aldeano',       'torso',   'Camisa de aldeano',       0,   1, 0),
  ('torso_explorador',    'torso',   'Jubón de explorador',     150, 2, 1),
  ('brazos_aldeano',      'brazos',  'Mangas de aldeano',       0,   1, 0),
  ('brazos_explorador',   'brazos',  'Brazales de explorador',  120, 2, 1),
  ('piernas_aldeano',     'piernas', 'Pantalón de aldeano',     0,   1, 0),
  ('piernas_explorador',  'piernas', 'Calzas de explorador',    100, 1, 1),
  ('pies_aldeano',        'pies',    'Botas de aldeano',        0,   1, 0),
  ('pies_explorador',     'pies',    'Botas de explorador',     90,  1, 1),
  ('cabeza_capucha',      'cabeza',  'Capucha de explorador',   140, 2, 0),
  ('hombros_hombreras',   'hombros', 'Hombreras',               180, 3, 0),
  ('arma_daga',           'arma',    'Daga',                    60,  1, 0),
  ('arma_daga_2',         'arma',    'Daga curva',              90,  1, 1),
  ('arma_hacha_pequena',  'arma',    'Hacha de mano',           110, 1, 2),
  ('arma_espada',         'arma',    'Espada',                  120, 1, 3),
  ('arma_martillo',       'arma',    'Martillo',                150, 2, 4),
  ('arma_espada_2',       'arma',    'Espada de caballero',     180, 3, 5),
  ('arma_lanza',          'arma',    'Lanza',                   200, 3, 6),
  ('arma_hacha',          'arma',    'Hacha de guerra',         220, 3, 7),
  ('arma_guadana',        'arma',    'Guadaña',                 300, 4, 8),
  ('arma_mandoble',       'arma',    'Mandoble',                350, 5, 9),
  ('arma_hacha_doble',    'arma',    'Hacha doble',             400, 6, 10),
  ('arma_martillo_doble', 'arma',    'Martillo de guerra',      450, 7, 11),
  ('arma_espada_grande',  'arma',    'Espadón',                 500, 8, 12),
  ('arma_espada_dorada',  'arma',    'Espada dorada',           800, 10, 13),
  ('escudo_redondo',      'escudo',  'Escudo redondo',          80,  1, 0),
  ('escudo_redondo_2',    'escudo',  'Escudo tachonado',        120, 2, 1),
  ('arco_madera',         'escudo',  'Arco de madera',          150, 2, 2),
  ('escudo_heraldico',    'escudo',  'Escudo heráldico',        200, 3, 3),
  ('escudo_heraldico_2',  'escudo',  'Escudo de torre',         260, 4, 4),
  ('arco_dorado',         'escudo',  'Arco dorado',             500, 8, 5),
  ('escudo_celta',        'escudo',  'Escudo celta dorado',     600, 9, 6),
  ('arco_maldito',        'escudo',  'Arco maldito',            650, 10, 7)
on conflict (id) do update set slot = excluded.slot, name = excluded.name,
  price = excluded.price, min_level = excluded.min_level, sort = excluded.sort;

-- Mismos umbrales que LVL en app.js
create or replace function public.nx_level(p_xp int) returns int
language sql immutable as $$
  select count(*)::int from unnest(array[0,500,1200,2500,4500,7000,10000,13500,17500,22000,
    27000,32500,38500,45000,52000,59500,67500,76000,85000,95000]) t where t <= coalesce(p_xp, 0);
$$;

-- Saldo: 50 de inicio + 40 por nivel + 25 por logro + 100 por mes ganado + 20 por logro de grupo − gastado
create or replace function public.nx_coins(u uuid) returns int
language sql stable security definer set search_path = public as $$
  select 50
    + 40 * (nx_level(p.xp) - 1)
    + 25 * (select count(distinct achievement_id) from user_achievements ua
             where ua.user_id = u and ua.achievement_id in
               ('first_mission','week_streak','month_perfect','monthly_winner','double_win','bonded','night_owl','momentum'))
    + 100 * (select count(*) from monthly_results r where r.winner_id = u)
    + 20 * (select count(*) from custom_achievement_unlocks c where c.user_id = u)
    - p.coins_spent
  from profiles p where p.id = u;
$$;

create or replace function public.my_coins() returns int
language sql stable security definer set search_path = public as $$ select nx_coins(auth.uid()); $$;

create or replace function public.buy_item(p_item text) returns int
language plpgsql security definer set search_path = public as $$
declare it shop_items; p profiles; bal int;
begin
  select * into it from shop_items where id = p_item;
  if not found then raise exception 'Objeto no encontrado'; end if;
  select * into p from profiles where id = auth.uid() for update;  -- evita compras dobles simultáneas
  if not found then raise exception 'No autenticado'; end if;
  if it.price = 0 or exists(select 1 from owned_items where user_id = auth.uid() and item_id = it.id) then
    raise exception 'Ya lo tienes';
  end if;
  if nx_level(p.xp) < it.min_level then raise exception 'Necesitas nivel %', it.min_level; end if;
  bal := nx_coins(auth.uid());
  if bal < it.price then raise exception 'Te faltan % monedas', it.price - bal; end if;
  insert into owned_items(user_id, item_id) values (auth.uid(), it.id);
  update profiles set coins_spent = coins_spent + it.price where id = auth.uid();
  return bal - it.price;
end $$;

-- Guarda el personaje validando rasgos y que cada objeto equipado sea gratis o comprado
create or replace function public.set_avatar(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_slot text; v_item text; v_equip jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if coalesce(p->>'sex', '') not in ('m','f') or coalesce(p->>'age', '') not in ('teen','adult')
     or coalesce(p->>'skin', '') !~ '^[0-5]$' or coalesce(p->>'eyes', '') !~ '^[0-5]$'
     or coalesce(p->>'hairColor', '') !~ '^[0-7]$'
     or coalesce(p->>'hair', '') not in ('buzzed','simpleparted','buzzedfemale','long','buns') then
    raise exception 'Personaje no válido';
  end if;
  foreach v_slot in array array['cabeza','torso','brazos','piernas','pies','hombros','arma','escudo'] loop
    v_item := p->'equip'->>v_slot;
    if v_item is not null then
      if not exists(select 1 from shop_items s where s.id = v_item and s.slot = v_slot
                    and (s.price = 0 or exists(select 1 from owned_items o where o.user_id = auth.uid() and o.item_id = s.id))) then
        raise exception 'No tienes ese objeto';
      end if;
      v_equip := v_equip || jsonb_build_object(v_slot, v_item);
    end if;
  end loop;
  update profiles set avatar = jsonb_build_object(
      'sex', p->>'sex', 'age', p->>'age', 'skin', (p->>'skin')::int, 'eyes', (p->>'eyes')::int,
      'hair', p->>'hair', 'hairColor', (p->>'hairColor')::int,
      'beard', coalesce((p->>'beard')::boolean, false) and p->>'sex' = 'm', 'equip', v_equip)
   where id = auth.uid();
  return (select avatar from profiles where id = auth.uid());
end $$;

do $$ declare f text; begin
  foreach f in array array['nx_coins(uuid)', 'my_coins()', 'buy_item(text)', 'set_avatar(jsonb)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
