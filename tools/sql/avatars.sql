-- 學生角色（2026-11-20）：每個「班級＋座號」一個 3D 角色（只存零件設定 cfg，不存姓名）
-- 學生只能用 RPC：avatar_get、avatar_list（公開）、avatar_create（還沒有角色時才能建立）、avatar_change（要老師的換座號密碼）
-- 另外：raid_host 的 recent 多回傳 seat（大螢幕依武器播攻擊特效），raid_reveal 多回傳 okseats（同步作答答對的座號）

create table if not exists public.avatars (
  class_name text not null default '',
  seat int not null check (seat between 1 and 40),
  cfg jsonb not null,
  device text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (class_name, seat)
);
alter table public.avatars enable row level security;
drop policy if exists avatars_teacher on public.avatars;
create policy avatars_teacher on public.avatars for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

create or replace function public.avatar_ok(p_cfg jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select p_cfg is not null and jsonb_typeof(p_cfg) = 'object' and pg_column_size(p_cfg) <= 3000
$$;

create or replace function public.avatar_get(p_class text, p_seat int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select cfg from public.avatars where class_name = coalesce(p_class, '') and seat = p_seat
$$;

create or replace function public.avatar_list(p_class text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('seat', seat, 'cfg', cfg) order by seat), '[]'::jsonb)
  from public.avatars where class_name = coalesce(p_class, '')
$$;

create or replace function public.avatar_create(p_class text, p_seat int, p_device text, p_cfg jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare c text := coalesce(p_class, '');
begin
  if p_seat is null or p_seat not between 1 and 40 then return 'bad'; end if;
  if p_device is null or char_length(p_device) not between 8 and 64 then return 'bad_device'; end if;
  if not public.avatar_ok(p_cfg) then return 'bad'; end if;
  if c <> '' and not exists (select 1 from public.class_list where name = c) then return 'bad_class'; end if;
  if (select count(*) from public.avatars where device = p_device and created_at > now() - interval '10 minutes') >= 8 then return 'too_many'; end if;
  insert into public.avatars(class_name, seat, cfg, device) values (c, p_seat, p_cfg, p_device) on conflict do nothing;
  if not found then return 'exists'; end if;
  return 'ok';
end $$;

-- p_cfg 是 null 時只驗證密碼（打開編輯器前）；有 p_cfg 時再驗一次密碼並存檔
create or replace function public.avatar_change(p_class text, p_seat int, p_device text, p_pin text, p_cfg jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare r text; c text := coalesce(p_class, '');
begin
  if p_seat is null or p_seat not between 1 and 40 then return 'bad'; end if;
  r := public.seat_unlock(p_device, p_pin);
  if r <> 'ok' then return r; end if;
  if p_cfg is null then return 'ok'; end if;
  if not public.avatar_ok(p_cfg) then return 'bad'; end if;
  insert into public.avatars(class_name, seat, cfg, device) values (c, p_seat, p_cfg, p_device)
  on conflict (class_name, seat) do update set cfg = excluded.cfg, device = excluded.device, updated_at = now();
  return 'ok';
end $$;

revoke all on public.avatars from anon;
grant execute on function public.avatar_get(text, int), public.avatar_list(text), public.avatar_create(text, int, text, jsonb), public.avatar_change(text, int, text, text, jsonb) to anon, authenticated;

-- raid_host：recent 多帶 seat
create or replace function public.raid_host(p_room text)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare r public.raid_rooms; fr boolean;
begin
  if not public.is_teacher() then return null; end if;
  select * into r from public.raid_rooms where id = p_room;
  if r.id is null then return null; end if;
  fr := r.mode in ('free','team');
  return jsonb_build_object('mode', r.mode, 'status', r.status, 'result', r.result, 'round', r.round, 'hp', r.hp, 'max_hp', r.max_hp,
    'teams', r.teams, 'team_hp', to_jsonb(r.team_hp), 'team_max', to_jsonb(r.team_max), 'winner', r.winner,
    'seats', (select coalesce(jsonb_agg(seat order by seat), '[]'::jsonb) from public.raid_players where room_id = p_room),
    'tseats', (select coalesce(jsonb_agg(jsonb_build_object('seat', seat, 'team', team) order by seat), '[]'::jsonb) from public.raid_players where room_id = p_room),
    'answered', case when fr then (select count(distinct (seat, qid)) from public.raid_free_log where room_id = p_room)
                     else (select count(*) from public.raid_answers where room_id = p_room and round = r.round) end,
    'correct', (select count(*) from public.raid_free_log where room_id = p_room and correct and attempt = 1),
    'last_id', (select coalesce(max(id), 0) from public.raid_free_log where room_id = p_room),
    'recent', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'dmg', x.dmg, 'team', p.team, 'seat', x.seat) order by x.id), '[]'::jsonb)
               from (select id, seat, dmg from public.raid_free_log where room_id = p_room and correct order by id desc limit 30) x
               left join public.raid_players p on p.room_id = p_room and p.seat = x.seat),
    'board', case when fr then (select coalesce(jsonb_agg(jsonb_build_object('seat', s.seat, 'ok', s.ok, 'dmg', s.dmg, 'team', p.team) order by s.ok desc, s.dmg desc, s.seat), '[]'::jsonb)
               from (select seat, count(*) filter (where correct and dmg > 0) ok, coalesce(sum(dmg),0) dmg from public.raid_free_log where room_id = p_room group by seat) s
               left join public.raid_players p on p.room_id = p_room and p.seat = s.seat) end,
    'acc', case when fr then (select coalesce(jsonb_agg(jsonb_build_object('seat', seat, 'ok', ok, 'n', n, 'pct', round(ok * 100.0 / n)) order by ok::float / n desc, n desc, seat), '[]'::jsonb)
               from (select seat, count(*) filter (where attempt = 1) n, count(*) filter (where attempt = 1 and correct) ok
                     from public.raid_free_log where room_id = p_room group by seat having count(*) filter (where attempt = 1) >= 10) s) end,
    'tstat', case when r.mode = 'team' then (select coalesce(jsonb_agg(jsonb_build_object('t', t,
                'n', (select count(*) from public.raid_players p where p.room_id = p_room and p.team = t),
                'first', (select count(*) from public.raid_free_log l join public.raid_players p on p.room_id = l.room_id and p.seat = l.seat where l.room_id = p_room and p.team = t and l.attempt = 1),
                'ok', (select count(*) from public.raid_free_log l join public.raid_players p on p.room_id = l.room_id and p.seat = l.seat where l.room_id = p_room and p.team = t and l.attempt = 1 and l.correct)
              ) order by t), '[]'::jsonb) from generate_series(1, r.teams) t) end,
    'opt_counter', r.opt_counter, 'opt_revenge', r.opt_revenge,
    'rev', r.opt_revenge and r.status = 'play' and r.ends_at is not null and now() >= r.ends_at - interval '3 minutes',
    'counter', case when r.counter is not null then r.counter || jsonb_build_object(
                  'left', greatest(0, ceil(extract(epoch from ((r.counter->>'ends')::timestamptz - now()))))::int,
                  'answered', (select count(*) from public.raid_counter_ans where room_id = p_room and n = (r.counter->>'n')::int)) end,
    'left', case when r.status = 'question' and r.deadline is not null then greatest(0, ceil(extract(epoch from (r.deadline - now()))))::int
                 when r.status = 'play' and r.ends_at is not null then greatest(0, ceil(extract(epoch from (r.ends_at - now()))))::int end);
end $function$;

-- raid_reveal：多回傳 okseats
create or replace function public.raid_reveal(p_room text)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare r public.raid_rooms; n_ok int; n_ans int; n_pl int; dmg int; crit boolean;
begin
  if not public.is_teacher() then return null; end if;
  select * into r from public.raid_rooms where id = p_room for update;
  if r.id is null or r.status <> 'question' then return null; end if;
  select count(*) filter (where correct), count(*) into n_ok, n_ans from public.raid_answers where room_id = p_room and round = r.round;
  select count(*) into n_pl from public.raid_players where room_id = p_room;
  crit := n_pl > 0 and n_ok * 10 >= n_pl * 8;
  dmg := n_ok + case when crit then ceil(n_ok * 0.5)::int else 0 end;
  update public.raid_rooms set status = 'reveal', hp = greatest(0, hp - dmg), updated_at = now() where id = p_room;
  return jsonb_build_object('ok', n_ok, 'answered', n_ans, 'players', n_pl, 'damage', dmg, 'crit', crit,
    'hp', greatest(0, r.hp - dmg),
    'okseats', (select coalesce(jsonb_agg(seat order by seat), '[]'::jsonb) from public.raid_answers where room_id = p_room and round = r.round and correct),
    'dist', (select coalesce(jsonb_object_agg(c, n), '{}'::jsonb) from (select choice::text c, count(*) n from public.raid_answers where room_id = p_room and round = r.round group by choice) x));
end $function$;
