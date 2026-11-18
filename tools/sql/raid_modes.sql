-- 2026-11-18 全班共戰新增：分隊競賽（mode='team'）、情境闖關（mode='story'），
-- 以及開房間時可選的「魔王反擊」（opt_counter）與「錯題復仇戰」（opt_revenge）。
alter table public.raid_rooms drop constraint if exists raid_rooms_mode_check;
alter table public.raid_rooms add constraint raid_rooms_mode_check check (mode in ('sync','free','team','story'));
alter table public.raid_rooms
  add column if not exists teams int not null default 0 check (teams between 0 and 4),
  add column if not exists team_hp int[],
  add column if not exists team_max int[],
  add column if not exists winner int,
  add column if not exists opt_counter boolean not null default false,
  add column if not exists opt_revenge boolean not null default false,
  add column if not exists counter jsonb,
  add column if not exists counter_key jsonb,
  add column if not exists counter_n int not null default 0,
  add column if not exists story text;
alter table public.raid_players
  add column if not exists team int,
  add column if not exists cur_rev boolean not null default false;

create table if not exists public.raid_counter_ans(
  room_id text not null references public.raid_rooms(id) on delete cascade,
  n int not null, seat int not null, choice int, correct boolean,
  created_at timestamptz not null default now(),
  primary key (room_id, n, seat));
alter table public.raid_counter_ans enable row level security;
drop policy if exists raid_counter_ans_teacher on public.raid_counter_ans;
create policy raid_counter_ans_teacher on public.raid_counter_ans for all using (public.is_teacher()) with check (public.is_teacher());

-- 加入：分隊競賽依座號自動分隊（座號 1、5、9… 第 1 隊，依隊數輪流）
create or replace function public.raid_join(p_room text, p_seat integer, p_device text)
returns text language plpgsql security definer set search_path to '' as $function$
declare r public.raid_rooms; other text;
begin
  select * into r from public.raid_rooms where id = p_room;
  if r.id is null then return 'no_room'; end if;
  if r.status = 'end' then return 'ended'; end if;
  if p_seat is null or p_seat < 1 or p_seat > 40 then return 'bad_seat'; end if;
  if p_device is null or char_length(p_device) not between 8 and 64 then return 'bad_device'; end if;
  select device into other from public.raid_players where room_id = p_room and seat = p_seat;
  if other is not null and other <> p_device then return 'seat_taken'; end if;
  if other is null then
    if (select count(*) from public.raid_players where room_id = p_room) >= 40 then return 'full'; end if;
    insert into public.raid_players(room_id, seat, device, team)
    values (p_room, p_seat, p_device, case when r.teams > 1 then ((p_seat - 1) % r.teams) + 1 end);
  end if;
  return 'ok';
end $function$;

-- 開始各自搶攻／分隊競賽
create or replace function public.raid_free_start(p_room text, p_minutes integer, p_hp_per_min integer)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare r public.raid_rooms; n_pl int; v_hp int; v_min int := greatest(1, least(coalesce(p_minutes, 5), 30));
  v_k int := greatest(1, coalesce(p_hp_per_min, 3)); arr int[];
begin
  if not public.is_teacher() then return null; end if;
  select * into r from public.raid_rooms where id = p_room for update;
  if r.id is null or r.status <> 'lobby' then return public.raid_host(p_room); end if;
  if r.mode = 'team' and r.teams > 1 then
    update public.raid_players set team = ((seat - 1) % r.teams) + 1 where room_id = p_room and team is null;
    select array_agg(greatest(10, coalesce(x.c, 0) * v_min * v_k) order by t) into arr
      from generate_series(1, r.teams) t
      left join (select team, count(*) c from public.raid_players where room_id = p_room group by team) x on x.team = t;
    v_hp := (select sum(v) from unnest(arr) v);
    update public.raid_rooms set status = 'play', hp = v_hp, max_hp = v_hp, team_hp = arr, team_max = arr, winner = null,
      ends_at = now() + make_interval(mins => v_min), updated_at = now() where id = p_room;
  else
    select count(*) into n_pl from public.raid_players where room_id = p_room;
    v_hp := greatest(10, n_pl * v_min * v_k);
    update public.raid_rooms set mode = 'free', status = 'play', hp = v_hp, max_hp = v_hp,
      ends_at = now() + make_interval(mins => v_min), updated_at = now() where id = p_room;
  end if;
  return public.raid_host(p_room);
end $function$;

-- 出題：最後 3 分鐘若開了「錯題復仇戰」，從這一場全班第 1 次答對率最低的題目出，傷害 ×2
create or replace function public.raid_free_q(p_room text, p_seat integer, p_device text)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare r public.raid_rooms; pl public.raid_players; b public.raid_bank; ord jsonb; opts jsonb; wait int; rev boolean := false; last_q int;
begin
  select * into r from public.raid_rooms where id = p_room;
  if r.id is null then return jsonb_build_object('err','no_room'); end if;
  if r.status <> 'play' then return jsonb_build_object('err','not_playing'); end if;
  if r.ends_at is not null and now() > r.ends_at then return jsonb_build_object('err','time_up'); end if;
  select * into pl from public.raid_players where room_id = p_room and seat = p_seat and device = coalesce(p_device,'') for update;
  if pl.seat is null then return jsonb_build_object('err','not_joined'); end if;
  if pl.cur_q is null then
    if r.opt_revenge and r.ends_at is not null and now() >= r.ends_at - interval '3 minutes' then
      last_q := pl.seen[array_length(pl.seen, 1)];
      select bk.* into b from public.raid_bank bk
       where bk.id in (select qid from public.raid_free_log where room_id = p_room and attempt = 1
                       group by qid having count(*) >= 2 and count(*) filter (where correct) < count(*) * 0.85
                       order by count(*) filter (where correct)::float / count(*), count(*) desc limit 12)
         and bk.id is distinct from last_q
       order by random() limit 1;
      if b.id is not null then rev := true; end if;
    end if;
    if b.id is null then
      select * into b from public.raid_bank where game = r.game and not (id = any(pl.seen)) order by random() limit 1;
      if b.id is null then
        update public.raid_players set seen = '{}' where room_id = p_room and seat = p_seat;
        select * into b from public.raid_bank where game = r.game order by random() limit 1;
      end if;
    end if;
    if b.id is null then return jsonb_build_object('err','no_bank'); end if;
    if b.ox then ord := '[0,1]'::jsonb;
    else select jsonb_agg(i order by random()) into ord from generate_series(0, jsonb_array_length(b.o) - 1) i; end if;
    update public.raid_players set cur_q = b.id, cur_order = ord, tries = 0, cur_wrong = '{}', cur_rev = rev where room_id = p_room and seat = p_seat;
    pl.tries := 0; pl.cur_wrong := '{}';
  else
    select * into b from public.raid_bank where id = pl.cur_q; ord := pl.cur_order; rev := pl.cur_rev;
  end if;
  if b.ox then opts := '["O","X"]'::jsonb;
  else select jsonb_agg(b.o -> (x::text)::int order by n) into opts from jsonb_array_elements(ord) with ordinality t(x, n); end if;
  wait := case when pl.next_at is not null and pl.next_at > now() then ceil(extract(epoch from (pl.next_at - now())))::int else 0 end;
  return jsonb_build_object('qid', b.id, 'q', b.q, 'o', opts, 'ox', b.ox, 'd', b.d, 'wait', wait, 'streak', pl.streak,
    'tries', pl.tries, 'wrong', to_jsonb(pl.cur_wrong), 'rev', rev);
end $function$;

create or replace function public.raid_free_answer(p_room text, p_seat integer, p_device text, p_qid integer, p_choice integer)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare r public.raid_rooms; pl public.raid_players; b public.raid_bank; ok boolean; right_idx int; dmg int := 0; st int; newhp int; right_text text; att int;
  th int; tm int; mul int;
begin
  select * into r from public.raid_rooms where id = p_room;
  if r.id is null then return jsonb_build_object('err','no_room'); end if;
  if r.status <> 'play' then return jsonb_build_object('err','not_playing', 'status', r.status, 'result', r.result); end if;
  if r.ends_at is not null and now() > r.ends_at + interval '2 seconds' then return jsonb_build_object('err','time_up'); end if;
  select * into pl from public.raid_players where room_id = p_room and seat = p_seat and device = coalesce(p_device,'') for update;
  if pl.seat is null then return jsonb_build_object('err','not_joined'); end if;
  if pl.cur_q is null or pl.cur_q <> p_qid then return jsonb_build_object('err','stale'); end if;
  if pl.next_at is not null and now() < pl.next_at - interval '300 milliseconds' then return jsonb_build_object('err','wait'); end if;
  if p_choice is null or p_choice < 0 or p_choice > 5 or p_choice = any(pl.cur_wrong) then return jsonb_build_object('err','bad_choice'); end if;
  select * into b from public.raid_bank where id = p_qid;
  if b.ox then right_idx := case when b.a = 'true'::jsonb then 0 else 1 end;
  else select (n - 1)::int into right_idx from jsonb_array_elements(pl.cur_order) with ordinality t(x, n) where (x::text)::int = (b.a::text)::int; end if;
  ok := p_choice = right_idx;
  att := pl.tries + 1;
  mul := case when pl.cur_rev then 2 else 1 end;
  if r.mode = 'team' and pl.team is not null and r.team_hp is not null then th := r.team_hp[pl.team]; tm := r.team_max[pl.team]; end if;
  if not ok then
    update public.raid_players set tries = att, cur_wrong = array_append(cur_wrong, p_choice), streak = 0, next_at = now() + interval '3 seconds'
    where room_id = p_room and seat = p_seat;
    insert into public.raid_free_log(room_id, seat, qid, correct, dmg, attempt) values (p_room, p_seat, p_qid, false, 0, att);
    return jsonb_build_object('correct', false, 'attempt', att, 'wait', 3, 'hp', r.hp, 'max_hp', r.max_hp, 'team_hp', th, 'team_max', tm,
      'next_dmg', (case when att = 1 and not b.ox then 1 else 0 end) * mul, 'rev', pl.cur_rev);
  end if;
  st := case when att = 1 then pl.streak + 1 else 0 end;
  dmg := (case when att = 1 then 2 when att = 2 and not b.ox then 1 else 0 end + case when att = 1 and st % 5 = 0 then 1 else 0 end) * mul;
  right_text := case when b.ox then (case when right_idx = 0 then 'O' else 'X' end) else b.o ->> ((b.a::text)::int) end;
  update public.raid_players set cur_q = null, cur_order = null, tries = 0, cur_wrong = '{}', seen = array_append(seen, p_qid), streak = st, next_at = now(), cur_rev = false
  where room_id = p_room and seat = p_seat;
  insert into public.raid_free_log(room_id, seat, qid, correct, dmg, attempt) values (p_room, p_seat, p_qid, true, dmg, att);
  newhp := r.hp;
  if dmg > 0 then
    if th is not null then
      update public.raid_rooms set team_hp[pl.team] = greatest(0, team_hp[pl.team] - dmg), hp = greatest(0, hp - dmg), updated_at = now()
       where id = p_room returning team_hp[pl.team], hp into th, newhp;
      if th <= 0 then update public.raid_rooms set status = 'end', result = 'win', winner = pl.team where id = p_room and status = 'play'; end if;
    else
      update public.raid_rooms set hp = greatest(0, hp - dmg), updated_at = now() where id = p_room returning hp into newhp;
      if newhp <= 0 then update public.raid_rooms set status = 'end', result = 'win' where id = p_room and status = 'play'; end if;
    end if;
  end if;
  return jsonb_build_object('correct', true, 'attempt', att, 'answer', right_text, 'e', b.e, 'dmg', dmg, 'streak', st, 'hp', newhp, 'max_hp', r.max_hp,
    'team_hp', th, 'team_max', tm, 'rev', pl.cur_rev, 'wait', 0);
end $function$;

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
    'recent', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'dmg', x.dmg, 'team', p.team) order by x.id), '[]'::jsonb)
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
    'game', r.game, 'mode', r.mode, 'status', r.status, 'round', r.round, 'rounds', r.rounds, 'hp', r.hp, 'max_hp', r.max_hp, 'result', r.result,
    'joined', me, 'team', myteam, 'teams', r.teams, 'team_hp', to_jsonb(r.team_hp), 'team_max', to_jsonb(r.team_max), 'winner', r.winner,
    'opt_counter', r.opt_counter, 'opt_revenge', r.opt_revenge,
    'rev', r.opt_revenge and r.status = 'play' and r.ends_at is not null and now() >= r.ends_at - interval '3 minutes',
    'counter', ctr,
    'players', (select count(*) from public.raid_players where room_id = p_room),
    'question', case when r.mode in ('sync','story') and r.status in ('question','reveal') then r.question end,
    'left', case when r.status = 'question' and r.deadline is not null then greatest(0, ceil(extract(epoch from (r.deadline - now()))))::int
                 when r.status = 'play' and r.ends_at is not null then greatest(0, ceil(extract(epoch from (r.ends_at - now()))))::int end,
    'answered', a.seat is not null,
    'my_choice', a.choice,
    'my_correct', case when r.status = 'reveal' and a.seat is not null then a.correct end,
    'answer', case when r.mode in ('sync','story') and r.status in ('reveal','end') then r.answer end,
    'my_right', mine, 'my_total', total, 'my_dmg', mydmg);
end $function$;

-- 魔王反擊：大螢幕與平板同時出一題全班題，限時作答
create or replace function public.raid_counter_start(p_room text, p_q jsonb, p_key jsonb, p_secs integer)
returns jsonb language plpgsql security definer set search_path to '' as $function$
begin
  if not public.is_teacher() then return null; end if;
  update public.raid_rooms set counter_n = counter_n + 1,
    counter = jsonb_build_object('n', counter_n + 1, 'q', p_q->>'q', 'o', p_q->'o', 'ox', coalesce((p_q->>'ox')::boolean, false), 'd', p_q->>'d',
      'ends', now() + make_interval(secs => least(greatest(coalesce(p_secs, 30), 10), 90))),
    counter_key = p_key, updated_at = now()
  where id = p_room and status = 'play' and (counter is null or coalesce((counter->>'done')::boolean, false));
  return public.raid_host(p_room);
end $function$;

create or replace function public.raid_counter_answer(p_room text, p_seat integer, p_device text, p_n integer, p_choice integer)
returns text language plpgsql security definer set search_path to '' as $function$
declare r public.raid_rooms;
begin
  select * into r from public.raid_rooms where id = p_room;
  if r.id is null then return 'no_room'; end if;
  if r.counter is null or coalesce((r.counter->>'done')::boolean, false) or (r.counter->>'n')::int <> p_n then return 'closed'; end if;
  if now() > (r.counter->>'ends')::timestamptz + interval '2 seconds' then return 'late'; end if;
  if not exists(select 1 from public.raid_players where room_id = p_room and seat = p_seat and device = coalesce(p_device,'')) then return 'not_joined'; end if;
  if p_choice is null or p_choice < 0 or p_choice > 5 then return 'bad'; end if;
  insert into public.raid_counter_ans(room_id, n, seat, choice, correct)
  values (p_room, p_n, p_seat, p_choice, p_choice = (r.counter_key->>'a')::int) on conflict do nothing;
  if not found then return 'already'; end if;
  return 'ok';
end $function$;

-- 結算魔王反擊：8 成以上答對完全擋下；5～8 成魔王回 5% 血；不到 5 成回 10% 血（分隊競賽各隊分開算）
create or replace function public.raid_counter_end(p_room text)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare r public.raid_rooms; res jsonb := '[]'::jsonb; g record; heal int; th int[]; cn int; n_pl int; n_ok int; dist jsonb;
begin
  if not public.is_teacher() then return null; end if;
  select * into r from public.raid_rooms where id = p_room for update;
  if r.counter is null or coalesce((r.counter->>'done')::boolean, false) then return r.counter; end if;
  cn := (r.counter->>'n')::int;
  if r.mode = 'team' and r.teams > 1 and r.team_hp is not null then
    th := r.team_hp;
    for g in select t,
        (select count(*) from public.raid_players p where p.room_id = p_room and p.team = t) n,
        (select count(*) from public.raid_counter_ans a join public.raid_players p on p.room_id = a.room_id and p.seat = a.seat
          where a.room_id = p_room and a.n = cn and a.correct and p.team = t) ok
      from generate_series(1, r.teams) t loop
      heal := case when g.n = 0 or g.ok * 10 >= g.n * 8 then 0 when g.ok * 2 >= g.n then ceil(r.team_max[g.t] * 0.05) else ceil(r.team_max[g.t] * 0.10) end;
      if r.status <> 'play' or th[g.t] <= 0 then heal := 0; end if;
      th[g.t] := least(r.team_max[g.t], th[g.t] + heal);
      res := res || jsonb_build_array(jsonb_build_object('t', g.t, 'n', g.n, 'ok', g.ok, 'heal', heal));
    end loop;
    update public.raid_rooms set team_hp = th, hp = (select sum(v) from unnest(th) v) where id = p_room;
  else
    select count(*) into n_pl from public.raid_players where room_id = p_room;
    select count(*) into n_ok from public.raid_counter_ans where room_id = p_room and n = cn and correct;
    heal := case when n_pl = 0 or n_ok * 10 >= n_pl * 8 then 0 when n_ok * 2 >= n_pl then ceil(r.max_hp * 0.05) else ceil(r.max_hp * 0.10) end;
    if r.status <> 'play' or r.hp <= 0 then heal := 0; end if;
    update public.raid_rooms set hp = least(max_hp, hp + heal) where id = p_room;
    res := jsonb_build_array(jsonb_build_object('t', 0, 'n', n_pl, 'ok', n_ok, 'heal', heal));
  end if;
  select coalesce(jsonb_object_agg(c, k), '{}'::jsonb) into dist
    from (select choice::text c, count(*) k from public.raid_counter_ans where room_id = p_room and n = cn group by choice) x;
  update public.raid_rooms set counter = counter || jsonb_build_object('done', true, 'a', counter_key->'a', 'e', counter_key->'e',
      'res', res, 'dist', dist, 'ends', least((counter->>'ends')::timestamptz, now())), updated_at = now()
   where id = p_room returning counter into dist;
  return dist;
end $function$;

create or replace function public.raid_finish(p_room text, p_result text)
returns void language plpgsql security definer set search_path to '' as $function$
declare r public.raid_rooms; sess text := 'raid:' || p_room; w int;
begin
  if not public.is_teacher() then return; end if;
  update public.raid_rooms set status = 'end', result = p_result, updated_at = now() where id = p_room;
  select * into r from public.raid_rooms where id = p_room;
  if r.id is null or p_result = 'cancel' then return; end if;
  if r.mode = 'team' and r.winner is null and r.team_hp is not null then
    select t into w from generate_series(1, r.teams) t order by r.team_hp[t]::float / greatest(1, r.team_max[t]), t limit 1;
    update public.raid_rooms set winner = w where id = p_room;
    r.winner := w;
  end if;
  if exists (select 1 from public.game_results where session = sess) then return; end if;
  if r.mode in ('free','team') then
    insert into public.game_results(game, title, class_name, seat, device, session, data, created_at)
    select coalesce(r.game,'u2') || case when r.mode = 'team' then '-team' else '-raid' end,
      case when r.mode = 'team' then '全班共戰・分隊競賽' else '全班共戰・各自搶攻' end, r.class_name, p.seat, p.device, sess,
      jsonb_build_object('mode', r.mode, 'result', p_result, 'team', p.team, 'winner', r.winner,
        'total', coalesce(s.total,0), 'right', coalesce(s.first_ok,0), 'done', coalesce(s.done,0), 'dmg', coalesce(s.dmg,0),
        'items', coalesce(s.items,'[]'::jsonb)), now()
    from public.raid_players p
    left join lateral (
      select count(*) total, count(*) filter (where q.first_ok) first_ok, count(*) filter (where q.done) done, sum(q.dmg) dmg,
             jsonb_agg(jsonb_build_object('q', b.q, 'ok', q.first_ok, 'tries', q.tries, 'done', q.done) order by q.first_at) items
      from (select qid, bool_or(correct and attempt = 1) first_ok, bool_or(correct) done, max(attempt) tries, sum(dmg) dmg, min(id) first_at
            from public.raid_free_log l where l.room_id = p_room and l.seat = p.seat group by qid) q
      join public.raid_bank b on b.id = q.qid) s on true
    where p.room_id = p_room;
  else
    insert into public.game_results(game, title, class_name, seat, device, session, data, created_at)
    select coalesce(r.game,'u2') || case when r.mode = 'story' then '-story' else '-raid' end,
      case when r.mode = 'story' then '情境闖關' else '全班共戰・同步作答' end, r.class_name, p.seat, p.device, sess,
      jsonb_build_object('mode', r.mode, 'result', p_result, 'story', r.story,
        'total', (select count(*) from public.raid_rounds where room_id = p_room),
        'right', (select count(*) from public.raid_answers a where a.room_id = p_room and a.seat = p.seat and a.correct),
        'answered', (select count(*) from public.raid_answers a where a.room_id = p_room and a.seat = p.seat),
        'items', (select coalesce(jsonb_agg(jsonb_build_object('q', rr.question->>'q', 'ok', coalesce(a.correct,false), 'skip', a.seat is null) order by rr.round), '[]'::jsonb)
                  from public.raid_rounds rr left join public.raid_answers a on a.room_id = rr.room_id and a.round = rr.round and a.seat = p.seat
                  where rr.room_id = p_room)), now()
    from public.raid_players p where p.room_id = p_room;
  end if;
end $function$;
