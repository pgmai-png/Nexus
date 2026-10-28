-- NEXUS · 001 · Endurecer seguridad
-- Antes: XP, rachas, marcador mensual y resultados se escribían desde el navegador,
-- monthly_xp/weekly_xp eran editables por cualquiera (incluso sin sesión) y casi
-- todas las tablas se podían leer sin iniciar sesión.
-- Ahora: lectura solo para usuarios autenticados y del mismo grupo, y la lógica
-- de juego (completar misiones, XP, logros, cierre de mes) va en funciones de servidor.

begin;

-- ─── Helpers ────────────────────────────────────────────────────────────────
create or replace function public.is_member(g uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists(select 1 from group_members where group_id = g and user_id = auth.uid());
$$;

create or replace function public.shares_group(u uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select u = auth.uid() or exists(
    select 1 from group_members a join group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = u);
$$;

-- "Hoy" en hora de España (la app la usan en España; evita el desfase UTC)
create or replace function public.nx_today() returns date
language sql stable as $$ select (now() at time zone 'Europe/Madrid')::date $$;

-- ─── Datos: las misiones privadas guardaban el título real en "title" ───────
update missions
   set private_title = coalesce(private_title, title), title = 'Misión privada'
 where private and title is distinct from 'Misión privada';

-- ─── Límites ────────────────────────────────────────────────────────────────
alter table missions drop constraint if exists missions_xp_range;
alter table missions add constraint missions_xp_range check (xp_value between 0 and 2000) not valid;
alter table custom_achievements drop constraint if exists custom_ach_xp_range;
alter table custom_achievements add constraint custom_ach_xp_range check (xp_bonus between 0 and 500) not valid;

create or replace function public.nx_check_group_size() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform 1 from groups where id = new.group_id for update;  -- serializa altas simultáneas
  if (select count(*) from group_members where group_id = new.group_id)
     >= coalesce((select max_members from groups where id = new.group_id), 6) then
    raise exception 'El grupo está lleno';
  end if;
  return new;
end $$;
drop trigger if exists nx_group_size on group_members;
create trigger nx_group_size before insert on group_members
  for each row execute function nx_check_group_size();

-- ─── Borrar todas las políticas anteriores ─────────────────────────────────
do $$ declare r record; begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ─── Permisos por columna / tabla ──────────────────────────────────────────
-- profiles: xp, racha y nivel solo cambian vía funciones
revoke insert, update on profiles from anon, authenticated;
grant insert (id, username) on profiles to authenticated;
grant update (username, avatar_url, avatar_color) on profiles to authenticated;

-- groups: el periodo actual solo lo cambia close_month
revoke insert, update on groups from anon, authenticated;
grant insert (name, created_by) on groups to authenticated;
grant update (name, wheel_enabled) on groups to authenticated;

-- missions: private_title no se puede leer directamente (ver my_private_titles)
revoke select on missions from anon, authenticated;
grant select (id, group_id, user_id, xp_value, approved_by, period_start, created_at,
              private, title, description, type) on missions to authenticated;

-- tablas que solo escriben las funciones
revoke insert, update, delete on mission_completions, monthly_xp, weekly_xp,
  monthly_results, weekly_results, custom_achievement_unlocks from anon, authenticated;

-- ─── Políticas (solo usuarios autenticados) ────────────────────────────────
create policy profiles_select on profiles for select to authenticated using (true);
create policy profiles_insert on profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy fr_select on friendships for select to authenticated
  using (auth.uid() in (requester_id, receiver_id));
create policy fr_insert on friendships for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');
create policy fr_update on friendships for update to authenticated   -- solo quien recibe acepta
  using (receiver_id = auth.uid()) with check (receiver_id = auth.uid());
create policy fr_delete on friendships for delete to authenticated
  using (auth.uid() in (requester_id, receiver_id));

create policy groups_select on groups for select to authenticated
  using (created_by = auth.uid() or is_member(id));
create policy groups_insert on groups for insert to authenticated with check (created_by = auth.uid());
create policy groups_update on groups for update to authenticated
  using (is_member(id)) with check (is_member(id));
create policy groups_delete on groups for delete to authenticated using (created_by = auth.uid());

create policy gm_select on group_members for select to authenticated
  using (user_id = auth.uid() or is_member(group_id));
create policy gm_insert on group_members for insert to authenticated with check (
  (user_id = auth.uid() and exists(select 1 from groups g where g.id = group_id and g.created_by = auth.uid()))
  or is_member(group_id));
create policy gm_delete on group_members for delete to authenticated using (user_id = auth.uid());

create policy goals_all on goals for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy mis_select on missions for select to authenticated
  using (user_id = auth.uid() or is_member(group_id));
create policy mis_insert on missions for insert to authenticated
  with check (user_id = auth.uid() and is_member(group_id));
create policy mis_update on missions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and is_member(group_id));
create policy mis_delete on missions for delete to authenticated using (user_id = auth.uid());

create policy mc_select on mission_completions for select to authenticated using (shares_group(user_id));

create policy mxp_select on monthly_xp for select to authenticated using (is_member(group_id));
create policy wxp_select on weekly_xp for select to authenticated using (is_member(group_id));
create policy mres_select on monthly_results for select to authenticated using (is_member(group_id));
create policy wres_select on weekly_results for select to authenticated using (is_member(group_id));

create policy ach_select on achievements for select to authenticated using (true);
create policy ua_select on user_achievements for select to authenticated using (shares_group(user_id));
create policy ua_insert on user_achievements for insert to authenticated with check (user_id = auth.uid());

create policy wi_select on wheel_items for select to authenticated using (is_member(group_id));
create policy wi_insert on wheel_items for insert to authenticated
  with check (added_by = auth.uid() and is_member(group_id));
create policy wi_delete on wheel_items for delete to authenticated using (added_by = auth.uid());

create policy ca_select on custom_achievements for select to authenticated using (is_member(group_id));
create policy ca_insert on custom_achievements for insert to authenticated
  with check (created_by = auth.uid() and is_member(group_id));
create policy ca_update on custom_achievements for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy ca_delete on custom_achievements for delete to authenticated using (created_by = auth.uid());

create policy cau_select on custom_achievement_unlocks for select to authenticated using (shares_group(user_id));

create policy notif_select on notifications for select to authenticated using (to_user_id = auth.uid());
create policy notif_update on notifications for update to authenticated
  using (to_user_id = auth.uid()) with check (to_user_id = auth.uid());
create policy notif_insert on notifications for insert to authenticated
  with check (from_user_id = auth.uid() and shares_group(to_user_id));

create policy push_all on push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── Funciones de juego ────────────────────────────────────────────────────
-- ¿La misión ya cuenta como hecha en su periodo? (diaria: hoy, semanal: esta semana, mensual: alguna vez)
create or replace function public.nx_completion_in_period(m missions) returns uuid
language sql security definer stable set search_path = public as $$
  select id from mission_completions
   where mission_id = m.id and user_id = m.user_id
     and (m.type = 'monthly'
          or (m.type = 'weekly' and completed_date >= date_trunc('week', nx_today())::date)
          or completed_date = nx_today())
   order by completed_date desc limit 1;
$$;

create or replace function public.complete_mission(p_mission uuid) returns json
language plpgsql security definer set search_path = public as $$
declare m missions; p profiles; t date := nx_today();
begin
  select * into m from missions where id = p_mission and user_id = auth.uid() and approved_by is not null;
  if not found then raise exception 'Misión no encontrada'; end if;
  select * into p from profiles where id = auth.uid() for update;
  if nx_completion_in_period(m) is not null then
    return json_build_object('xp', p.xp, 'streak', p.streak, 'added', 0);
  end if;
  insert into mission_completions(mission_id, user_id, completed_date) values (m.id, auth.uid(), t);
  update profiles set
    xp = xp + m.xp_value,
    streak = case when last_active = t then streak when last_active = t - 1 then streak + 1 else 1 end,
    last_active = t
  where id = auth.uid() returning * into p;
  if m.group_id is not null then
    insert into monthly_xp(group_id, user_id, period, xp) values (m.group_id, auth.uid(), to_char(t, 'YYYY-MM'), m.xp_value)
    on conflict (group_id, user_id, period) do update set xp = monthly_xp.xp + excluded.xp;
  end if;
  return json_build_object('xp', p.xp, 'streak', p.streak, 'added', m.xp_value);
end $$;

create or replace function public.uncomplete_mission(p_mission uuid) returns json
language plpgsql security definer set search_path = public as $$
declare m missions; p profiles; c mission_completions;
begin
  select * into m from missions where id = p_mission and user_id = auth.uid();
  if not found then raise exception 'Misión no encontrada'; end if;
  select * into p from profiles where id = auth.uid() for update;
  select * into c from mission_completions where id = nx_completion_in_period(m);
  if not found then return json_build_object('xp', p.xp, 'streak', p.streak, 'added', 0); end if;
  delete from mission_completions where id = c.id;
  update profiles set xp = greatest(0, xp - m.xp_value) where id = auth.uid() returning * into p;
  update monthly_xp set xp = greatest(0, xp - m.xp_value)
   where group_id = m.group_id and user_id = auth.uid() and period = to_char(c.completed_date, 'YYYY-MM');
  return json_build_object('xp', p.xp, 'streak', p.streak, 'added', -m.xp_value);
end $$;

create or replace function public.delete_mission(p_mission uuid) returns json
language plpgsql security definer set search_path = public as $$
declare m missions;
begin
  select * into m from missions where id = p_mission and user_id = auth.uid();
  if not found then raise exception 'Misión no encontrada'; end if;
  -- igual que antes: si estaba completada hoy, se descuenta su XP
  if exists(select 1 from mission_completions where mission_id = m.id and user_id = auth.uid() and completed_date = nx_today()) then
    perform uncomplete_mission(m.id);
  end if;
  delete from mission_completions where mission_id = m.id;
  delete from missions where id = m.id;
  return (select json_build_object('xp', xp) from profiles where id = auth.uid());
end $$;

create or replace function public.my_private_titles() returns table(id uuid, private_title text)
language sql security definer stable set search_path = public as $$
  select m.id, m.private_title from missions m where m.user_id = auth.uid() and m.private;
$$;

create or replace function public.join_group_by_code(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare target uuid; gid uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select id into target from profiles where friend_code = lower(trim(p_code));
  if target is null then raise exception 'Código no encontrado'; end if;
  select group_id into gid from group_members where user_id = target limit 1;
  if gid is null then raise exception 'Ese usuario no tiene grupo todavía'; end if;
  if not exists(select 1 from group_members where group_id = gid and user_id = auth.uid()) then
    insert into group_members(group_id, user_id) values (gid, auth.uid());
  end if;
  return gid;
end $$;

create or replace function public.award_custom_achievement(p_ach uuid, p_user uuid) returns json
language plpgsql security definer set search_path = public as $$
declare a custom_achievements;
begin
  select * into a from custom_achievements where id = p_ach;
  if not found or not is_member(a.group_id) then raise exception 'Logro no encontrado'; end if;
  if not exists(select 1 from group_members where group_id = a.group_id and user_id = p_user) then
    raise exception 'Ese usuario no está en el grupo';
  end if;
  insert into custom_achievement_unlocks(achievement_id, user_id) values (a.id, p_user);
  if coalesce(a.xp_bonus, 0) > 0 then
    update profiles set xp = xp + least(a.xp_bonus, 500) where id = p_user;
  end if;
  return json_build_object('xp_bonus', coalesce(a.xp_bonus, 0));
end $$;

-- Cierre de mes atómico: solo lo ejecuta el primero que abre la app en el mes nuevo
create or replace function public.close_month(p_group uuid) returns json
language plpgsql security definer set search_path = public as $$
declare g groups; cur text := to_char(nx_today(), 'YYYY-MM'); stored text;
        w record; l record; res json := null; mem record; goal text;
begin
  if not is_member(p_group) then raise exception 'No eres miembro de este grupo'; end if;
  select * into g from groups where id = p_group for update;
  stored := coalesce(g.current_period, cur);
  if stored >= cur then
    if g.current_period is null then update groups set current_period = cur where id = p_group; end if;
    return null;
  end if;

  select gm.user_id, coalesce(x.xp, 0) as xp into w
    from group_members gm left join monthly_xp x
      on x.group_id = gm.group_id and x.user_id = gm.user_id and x.period = stored
   where gm.group_id = p_group order by coalesce(x.xp, 0) desc limit 1;
  select gm.user_id, coalesce(x.xp, 0) as xp into l
    from group_members gm left join monthly_xp x
      on x.group_id = gm.group_id and x.user_id = gm.user_id and x.period = stored
   where gm.group_id = p_group order by coalesce(x.xp, 0) asc limit 1;

  if coalesce(w.xp, 0) > 0 then
    insert into monthly_results(group_id, period, winner_id, winner_xp, loser_id, loser_xp)
    values (p_group, stored, w.user_id, w.xp, l.user_id, l.xp)
    on conflict (group_id, period) do nothing;
    res := json_build_object('period', stored, 'winner_id', w.user_id, 'winner_xp', w.xp,
                             'loser_id', l.user_id, 'loser_xp', l.xp);
  end if;

  delete from mission_completions where mission_id in (select id from missions where group_id = p_group and type = 'monthly');
  delete from missions where group_id = p_group and type = 'monthly';
  for mem in select user_id from group_members where group_id = p_group loop
    select text into goal from goals where user_id = mem.user_id and group_id = p_group order by created_at limit 1;
    goal := coalesce(goal, 'tu objetivo');
    insert into missions(group_id, user_id, title, xp_value, type, period_start, approved_by) values
      (p_group, mem.user_id, 'Alcanzar un hito clave en: ' || goal, 400, 'monthly', nx_today(), mem.user_id),
      (p_group, mem.user_id, 'Completar un reto mensual', 500, 'monthly', nx_today(), mem.user_id),
      (p_group, mem.user_id, 'Mantener racha de 20 días', 450, 'monthly', nx_today(), mem.user_id);
  end loop;
  update groups set current_period = cur where id = p_group;
  return res;
end $$;

-- Solo usuarios autenticados pueden llamar a las funciones de juego
do $$ declare f text; begin
  foreach f in array array['complete_mission(uuid)', 'uncomplete_mission(uuid)', 'delete_mission(uuid)',
    'my_private_titles()', 'join_group_by_code(text)', 'award_custom_achievement(uuid,uuid)', 'close_month(uuid)',
    'nx_completion_in_period(missions)', 'nx_check_group_size()'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Ping para que el plan gratuito no pause el proyecto por inactividad (.github/workflows/keepalive.yml)
create or replace function public.keepalive() returns int language sql stable as $$ select 1 $$;
grant execute on function public.keepalive() to anon, authenticated;

notify pgrst, 'reload schema';
commit;
