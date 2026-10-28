-- NEXUS · 002 · Recordatorio diario, reacciones y comodín de racha
-- Monedas: no son retroactivas. Todos empiezan con 100 y solo cuenta lo conseguido
-- desde el lanzamiento (si contaran el pasado, los veteranos lo comprarían todo el día 1).

begin;

-- ─── Columnas nuevas en perfiles ────────────────────────────────────────────
alter table profiles add column if not exists coins_spent int not null default 0;
alter table profiles add column if not exists coins_base_xp int not null default 0;
alter table profiles add column if not exists streak_freezes int not null default 0;
alter table profiles add column if not exists reminder_hour int;
alter table profiles add column if not exists reminder_last date;
alter table profiles drop constraint if exists profiles_reminder_hour_check;
alter table profiles add constraint profiles_reminder_hour_check check (reminder_hour between 0 and 23);
-- El nivel de partida para las monedas es el actual de cada uno
update profiles set coins_base_xp = xp where coins_base_xp = 0 and xp > 0;
-- Cada uno elige su hora; solo eso es editable desde la app
grant update (reminder_hour) on profiles to authenticated;

-- ─── Monedas ────────────────────────────────────────────────────────────────
-- Mismos umbrales que LVL en app.js
create or replace function public.nx_level(p_xp int) returns int
language sql immutable as $$
  select count(*)::int from unnest(array[0,500,1200,2500,4500,7000,10000,13500,17500,22000,
    27000,32500,38500,45000,52000,59500,67500,76000,85000,95000]) t where t <= coalesce(p_xp, 0);
$$;

create or replace function public.nx_coins(u uuid) returns int
language sql stable security definer set search_path = public as $$
  select 100
    + 5   * (select count(*) from mission_completions c where c.user_id = u and c.completed_at >= timestamptz '2026-10-28')
    + 40  * greatest(0, nx_level(p.xp) - nx_level(p.coins_base_xp))
    + 25  * (select count(distinct achievement_id) from user_achievements ua
              where ua.user_id = u and ua.unlocked_at >= timestamptz '2026-10-28'
                and ua.achievement_id in ('first_mission','week_streak','month_perfect','monthly_winner','double_win','bonded','night_owl','momentum'))
    + 100 * (select count(*) from monthly_results r where r.winner_id = u and r.created_at >= timestamptz '2026-10-28')
    + 20  * (select count(*) from custom_achievement_unlocks cu where cu.user_id = u and cu.unlocked_at >= timestamptz '2026-10-28')
    - p.coins_spent
  from profiles p where p.id = u;
$$;

create or replace function public.my_wallet() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('coins', nx_coins(auth.uid()), 'freezes', streak_freezes, 'reminder_hour', reminder_hour)
  from profiles where id = auth.uid();
$$;

-- ─── Comodín de racha ───────────────────────────────────────────────────────
create or replace function public.buy_streak_freeze() returns json
language plpgsql security definer set search_path = public as $$
declare p profiles; bal int; price constant int := 150;
begin
  select * into p from profiles where id = auth.uid() for update;  -- evita compras dobles
  if not found then raise exception 'No autenticado'; end if;
  if p.streak_freezes >= 2 then raise exception 'Ya tienes el máximo de comodines (2)'; end if;
  bal := nx_coins(auth.uid());
  if bal < price then raise exception 'Te faltan % monedas', price - bal; end if;
  update profiles set coins_spent = coins_spent + price, streak_freezes = streak_freezes + 1
   where id = auth.uid() returning * into p;
  return json_build_object('coins', bal - price, 'freezes', p.streak_freezes);
end $$;

-- Completar misión: igual que en 001, pero si faltan días y hay comodines suficientes,
-- se gastan y la racha continúa
create or replace function public.complete_mission(p_mission uuid) returns json
language plpgsql security definer set search_path = public as $$
declare m missions; p profiles; t date := nx_today(); gap int; used int := 0;
begin
  select * into m from missions where id = p_mission and user_id = auth.uid() and approved_by is not null;
  if not found then raise exception 'Misión no encontrada'; end if;
  select * into p from profiles where id = auth.uid() for update;
  if nx_completion_in_period(m) is not null then
    return json_build_object('xp', p.xp, 'streak', p.streak, 'added', 0, 'freezes_used', 0, 'freezes', p.streak_freezes);
  end if;
  insert into mission_completions(mission_id, user_id, completed_date) values (m.id, auth.uid(), t);
  gap := case when p.last_active is null then null else t - p.last_active - 1 end;  -- días sin actividad
  if gap is not null and gap >= 1 and p.streak > 0 and gap <= p.streak_freezes then used := gap; end if;
  update profiles set
    xp = xp + m.xp_value,
    streak = case when last_active = t then streak
                  when last_active = t - 1 or used > 0 then streak + 1
                  else 1 end,
    streak_freezes = streak_freezes - used,
    last_active = t
  where id = auth.uid() returning * into p;
  if m.group_id is not null then
    insert into monthly_xp(group_id, user_id, period, xp) values (m.group_id, auth.uid(), to_char(t, 'YYYY-MM'), m.xp_value)
    on conflict (group_id, user_id, period) do update set xp = monthly_xp.xp + excluded.xp;
  end if;
  return json_build_object('xp', p.xp, 'streak', p.streak, 'added', m.xp_value, 'freezes_used', used, 'freezes', p.streak_freezes);
end $$;

-- ─── Reacciones ─────────────────────────────────────────────────────────────
create table if not exists reactions(
  id uuid primary key default gen_random_uuid(),
  completion_id uuid not null references mission_completions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  emoji text not null check (emoji in ('fire','clap','muscle')),
  created_at timestamptz not null default now(),
  unique (completion_id, user_id, emoji)
);
alter table reactions enable row level security;
drop policy if exists react_select on reactions;
drop policy if exists react_insert on reactions;
drop policy if exists react_delete on reactions;
create policy react_select on reactions for select to authenticated using (shares_group(user_id));
-- Solo a misiones de otros miembros de tus grupos
create policy react_insert on reactions for insert to authenticated with check (
  user_id = auth.uid() and exists(select 1 from mission_completions c
    where c.id = completion_id and c.user_id <> auth.uid() and shares_group(c.user_id)));
create policy react_delete on reactions for delete to authenticated using (user_id = auth.uid());
revoke update on reactions from anon, authenticated;

-- Nuevos tipos de aviso
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('mission_complete','xp_overtake','level_up','reaction','reminder'));

do $$ declare f text; begin
  foreach f in array array['nx_coins(uuid)', 'my_wallet()', 'buy_streak_freeze()', 'complete_mission(uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
