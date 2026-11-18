-- 2026-11-18 座號鎖定：學生選好座號後不能自己換，要老師輸入密碼（老師在後台設定）
create table if not exists public.app_settings(key text primary key, value text not null, updated_at timestamptz not null default now());
alter table public.app_settings enable row level security;
drop policy if exists app_settings_teacher on public.app_settings;
create policy app_settings_teacher on public.app_settings for all using (public.is_teacher()) with check (public.is_teacher());
create table if not exists public.seat_unlock_log(id bigint generated always as identity primary key, device text not null, ok boolean not null, created_at timestamptz not null default now());
create index if not exists seat_unlock_log_dev on public.seat_unlock_log(device, created_at);
alter table public.seat_unlock_log enable row level security;
drop policy if exists seat_unlock_log_teacher on public.seat_unlock_log;
create policy seat_unlock_log_teacher on public.seat_unlock_log for select using (public.is_teacher());

-- 老師設定換座號密碼（4～8 位數字），只存雜湊
create or replace function public.set_seat_pin(p_pin text)
returns text language plpgsql security definer set search_path to '' as $function$
begin
  if not public.is_teacher() then return 'not_teacher'; end if;
  if p_pin is null or p_pin !~ '^[0-9]{4,8}$' then return 'bad_pin'; end if;
  insert into public.app_settings(key, value, updated_at) values ('seat_pin', extensions.crypt(p_pin, extensions.gen_salt('bf')), now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return 'ok';
end $function$;

create or replace function public.seat_pin_status()
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.is_teacher() then return null; end if;
  return jsonb_build_object('set', exists(select 1 from public.app_settings where key = 'seat_pin'),
    'updated_at', (select updated_at from public.app_settings where key = 'seat_pin'),
    'recent', (select count(*) from public.seat_unlock_log where ok and created_at > now() - interval '7 days'));
end $function$;

-- 平板解鎖：同一台平板 10 分鐘內最多錯 5 次
create or replace function public.seat_unlock(p_device text, p_pin text)
returns text language plpgsql security definer set search_path to '' as $function$
declare h text; v_ok boolean;
begin
  if p_device is null or char_length(p_device) not between 8 and 64 then return 'bad_device'; end if;
  select value into h from public.app_settings where key = 'seat_pin';
  if h is null then return 'no_pin'; end if;
  if (select count(*) from public.seat_unlock_log where device = p_device and not ok and created_at > now() - interval '10 minutes') >= 5 then return 'too_many'; end if;
  v_ok := p_pin is not null and char_length(p_pin) <= 8 and extensions.crypt(p_pin, h) = h;
  insert into public.seat_unlock_log(device, ok) values (p_device, v_ok);
  delete from public.seat_unlock_log where created_at < now() - interval '30 days';
  return case when v_ok then 'ok' else 'wrong' end;
end $function$;
revoke all on function public.set_seat_pin(text) from public, anon;
grant execute on function public.set_seat_pin(text) to authenticated;

create or replace function public.raid_state(p_room text, p_seat integer, p_device text)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare r public.raid_rooms; me boolean; a public.raid_answers; mine int; total int; mydmg int := 0; myteam int; ctr jsonb;
begin
  select * into r from public.raid_rooms where id = p_room;
  if r.id is null then return null; end if;
  select team into myteam from public.raid_players where room_id = p_room and seat = p_seat and device = coalesce(p_device,'');
  me := found;
  if r.mode in ('free','team') then
    select count(*) filter (where correct and dmg > 0), count(distinct qid) filter (where correct), coalesce(sum(dmg),0)
      into mine, total, mydmg from public.raid_free_log where room_id = p_room and seat = p_seat;
  else
    select * into a from public.raid_answers where room_id = p_room and round = r.round and seat = p_seat;
    select count(*) filter (where correct), count(*) into mine, total from public.raid_answers where room_id = p_room and seat = p_seat;
  end if;
  if r.counter is not null and (not coalesce((r.counter->>'done')::boolean, false)
       or now() < (r.counter->>'ends')::timestamptz + interval '15 seconds') then
    ctr := r.counter || jsonb_build_object(
      'left', greatest(0, ceil(extract(epoch from ((r.counter->>'ends')::timestamptz - now()))))::int,
      'mine', (select choice from public.raid_counter_ans where room_id = p_room and n = (r.counter->>'n')::int and seat = p_seat));
  end if;
  return jsonb_build_object(
    'game', r.game, 'class_name', r.class_name, 'mode', r.mode, 'status', r.status, 'round', r.round, 'rounds', r.rounds, 'hp', r.hp, 'max_hp', r.max_hp, 'result', r.result,
    'joined', me, 'team', myteam, 'teams', r.teams, 'team_hp', to_jsonb(r.team_hp), 'team_max', to_jsonb(r.team_max), 'winner', r.winner,
    'opt_counter', r.opt_counter, 'opt_revenge', r.opt_revenge,
    'rev', r.opt_revenge and r.status = 'play' and r.ends_at is not null and now() >= r.ends_at - interval '3 minutes',
    'counter', ctr,
    'players', (select count(*) from public.raid_players where room_id = p_room),
    'question', case when r.mode in ('sync','story') and r.status in ('question','reveal') then r.question end,
    'q_age', case when r.status = 'question' and r.q_at is not null then round(extract(epoch from (now() - r.q_at))::numeric, 1) end,
    'left', case when r.status = 'question' and r.deadline is not null then greatest(0, ceil(extract(epoch from (r.deadline - now()))))::int
                 when r.status = 'play' and r.ends_at is not null then greatest(0, ceil(extract(epoch from (r.ends_at - now()))))::int end,
    'answered', a.seat is not null,
    'my_choice', a.choice,
    'my_correct', case when r.status = 'reveal' and a.seat is not null then a.correct end,
    'answer', case when r.mode in ('sync','story') and r.status in ('reveal','end') then r.answer end,
    'my_right', mine, 'my_total', total, 'my_dmg', mydmg);
end $function$;
