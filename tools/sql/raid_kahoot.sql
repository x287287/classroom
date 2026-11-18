-- 2026-11-18 全班共戰：先看題目再出選項（同步作答）、排序題、挑戰上一次的自己
alter table public.raid_bank add column if not exists ord boolean not null default false;
alter table public.raid_rooms add column if not exists q_at timestamptz, add column if not exists started_at timestamptz;

-- 出題：記下出題時間（q_at），平板依 question.pv（先看題目的秒數）晚一點才顯示選項
create or replace function public.raid_next(p_room text, p_question jsonb, p_answer jsonb, p_seconds integer, p_hp_per integer)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare r public.raid_rooms; n_pl int;
begin
  if not public.is_teacher() then return null; end if;
  select * into r from public.raid_rooms where id = p_room for update;
  if r.id is null or r.status = 'end' then return null; end if;
  if r.round >= r.rounds then return null; end if;
  if r.round = 0 then
    select count(*) into n_pl from public.raid_players where room_id = p_room;
    update public.raid_rooms set max_hp = greatest(5, n_pl * greatest(1, coalesce(p_hp_per, 7))), hp = greatest(5, n_pl * greatest(1, coalesce(p_hp_per, 7))),
      started_at = now() where id = p_room;
  end if;
  update public.raid_rooms set status = 'question', round = round + 1, question = p_question, answer = p_answer, q_at = now(),
    deadline = case when coalesce(p_seconds, 0) > 0 then now() + make_interval(secs => least(p_seconds, 320)) end, updated_at = now()
  where id = p_room;
  insert into public.raid_rounds(room_id, round, question, answer) values (p_room, r.round + 1, p_question, p_answer)
  on conflict (room_id, round) do update set question = excluded.question, answer = excluded.answer;
  return public.raid_host(p_room);
end $function$;

-- 作答：先看題目的時間還沒到就不收（排序題的 p_choice 是陣列）
create or replace function public.raid_answer(p_room text, p_round integer, p_seat integer, p_device text, p_choice jsonb)
returns text language plpgsql security definer set search_path to '' as $function$
declare r public.raid_rooms;
begin
  select * into r from public.raid_rooms where id = p_room;
  if r.id is null then return 'no_room'; end if;
  if r.status <> 'question' or r.round <> p_round then return 'closed'; end if;
  if r.deadline is not null and now() > r.deadline + interval '2 seconds' then return 'late'; end if;
  if r.q_at is not null and coalesce((r.question->>'pv')::numeric, 0) > 0
     and now() < r.q_at + make_interval(secs => (r.question->>'pv')::numeric - 0.8) then return 'early'; end if;
  if not exists(select 1 from public.raid_players where room_id = p_room and seat = p_seat and device = coalesce(p_device,'')) then return 'not_joined'; end if;
  if p_choice is null or pg_column_size(p_choice) > 200 then return 'bad'; end if;
  insert into public.raid_answers(room_id, round, seat, choice, correct)
  values (p_room, p_round, p_seat, p_choice, p_choice = (r.answer->'a'))
  on conflict do nothing;
  if not found then return 'already'; end if;
  return 'ok';
end $function$;

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
    update public.raid_rooms set status = 'play', hp = v_hp, max_hp = v_hp, team_hp = arr, team_max = arr, winner = null, started_at = now(),
      ends_at = now() + make_interval(mins => v_min), updated_at = now() where id = p_room;
  else
    select count(*) into n_pl from public.raid_players where room_id = p_room;
    v_hp := greatest(10, n_pl * v_min * v_k);
    update public.raid_rooms set mode = 'free', status = 'play', hp = v_hp, max_hp = v_hp, started_at = now(),
      ends_at = now() + make_interval(mins => v_min), updated_at = now() where id = p_room;
  end if;
  return public.raid_host(p_room);
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
    'q_age', case when r.status = 'question' and r.q_at is not null then round(extract(epoch from (now() - r.q_at))::numeric, 1) end,
    'left', case when r.status = 'question' and r.deadline is not null then greatest(0, ceil(extract(epoch from (r.deadline - now()))))::int
                 when r.status = 'play' and r.ends_at is not null then greatest(0, ceil(extract(epoch from (r.ends_at - now()))))::int end,
    'answered', a.seat is not null,
    'my_choice', a.choice,
    'my_correct', case when r.status = 'reveal' and a.seat is not null then a.correct end,
    'answer', case when r.mode in ('sync','story') and r.status in ('reveal','end') then r.answer end,
    'my_right', mine, 'my_total', total, 'my_dmg', mydmg);
end $function$;

-- 各自搶攻出題：排序題的選項也打亂（cur_order），回傳 ord
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
    else select jsonb_agg(i order by random()) into ord from generate_series(0, jsonb_array_length(b.o) - 1) i;
      if b.ord and ord = (select jsonb_agg(i order by i) from generate_series(0, jsonb_array_length(b.o) - 1) i) then
        select jsonb_agg(i order by i desc) into ord from generate_series(0, jsonb_array_length(b.o) - 1) i;
      end if;
    end if;
    update public.raid_players set cur_q = b.id, cur_order = ord, tries = 0, cur_wrong = '{}', cur_rev = rev where room_id = p_room and seat = p_seat;
    pl.tries := 0; pl.cur_wrong := '{}';
  else
    select * into b from public.raid_bank where id = pl.cur_q; ord := pl.cur_order; rev := pl.cur_rev;
  end if;
  if b.ox then opts := '["O","X"]'::jsonb;
  else select jsonb_agg(b.o -> (x::text)::int order by n) into opts from jsonb_array_elements(ord) with ordinality t(x, n); end if;
  wait := case when pl.next_at is not null and pl.next_at > now() then ceil(extract(epoch from (pl.next_at - now())))::int else 0 end;
  return jsonb_build_object('qid', b.id, 'q', b.q, 'o', opts, 'ox', b.ox, 'ord', b.ord, 'd', b.d, 'wait', wait, 'streak', pl.streak,
    'tries', pl.tries, 'wrong', to_jsonb(pl.cur_wrong), 'rev', rev);
end $function$;

-- 各自搶攻改題：排序題傳 p_order（平板上看到的選項編號，依學生排的順序）
drop function if exists public.raid_free_answer(text, integer, text, integer, integer);
create or replace function public.raid_free_answer(p_room text, p_seat integer, p_device text, p_qid integer, p_choice integer default null, p_order integer[] default null)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare r public.raid_rooms; pl public.raid_players; b public.raid_bank; ok boolean; right_idx int; dmg int := 0; st int; newhp int; right_text text; att int;
  th int; tm int; mul int; n int; pos_ok int := 0; i int;
begin
  select * into r from public.raid_rooms where id = p_room;
  if r.id is null then return jsonb_build_object('err','no_room'); end if;
  if r.status <> 'play' then return jsonb_build_object('err','not_playing', 'status', r.status, 'result', r.result); end if;
  if r.ends_at is not null and now() > r.ends_at + interval '2 seconds' then return jsonb_build_object('err','time_up'); end if;
  select * into pl from public.raid_players where room_id = p_room and seat = p_seat and device = coalesce(p_device,'') for update;
  if pl.seat is null then return jsonb_build_object('err','not_joined'); end if;
  if pl.cur_q is null or pl.cur_q <> p_qid then return jsonb_build_object('err','stale'); end if;
  if pl.next_at is not null and now() < pl.next_at - interval '300 milliseconds' then return jsonb_build_object('err','wait'); end if;
  select * into b from public.raid_bank where id = p_qid;
  if b.ord then
    n := jsonb_array_length(b.o);
    if p_order is null or coalesce(array_length(p_order, 1), 0) <> n
       or (select count(distinct x) from unnest(p_order) x where x between 0 and n - 1) <> n then
      return jsonb_build_object('err','bad_choice'); end if;
    for i in 1..n loop
      if ((pl.cur_order -> p_order[i])::text)::int = i - 1 then pos_ok := pos_ok + 1; end if;
    end loop;
    ok := pos_ok = n;
    select string_agg(x, ' → ' order by k) into right_text from jsonb_array_elements_text(b.o) with ordinality t(x, k);
  else
    if p_choice is null or p_choice < 0 or p_choice > 5 or p_choice = any(pl.cur_wrong) then return jsonb_build_object('err','bad_choice'); end if;
    if b.ox then right_idx := case when b.a = 'true'::jsonb then 0 else 1 end;
    else select (k - 1)::int into right_idx from jsonb_array_elements(pl.cur_order) with ordinality t(x, k) where (x::text)::int = (b.a::text)::int; end if;
    ok := p_choice = right_idx;
    right_text := case when b.ox then (case when right_idx = 0 then 'O' else 'X' end) else b.o ->> ((b.a::text)::int) end;
  end if;
  att := pl.tries + 1;
  mul := case when pl.cur_rev then 2 else 1 end;
  if r.mode = 'team' and pl.team is not null and r.team_hp is not null then th := r.team_hp[pl.team]; tm := r.team_max[pl.team]; end if;
  if not ok then
    update public.raid_players set tries = att, cur_wrong = case when b.ord then cur_wrong else array_append(cur_wrong, p_choice) end,
      streak = 0, next_at = now() + interval '3 seconds'
    where room_id = p_room and seat = p_seat;
    insert into public.raid_free_log(room_id, seat, qid, correct, dmg, attempt) values (p_room, p_seat, p_qid, false, 0, att);
    return jsonb_build_object('correct', false, 'attempt', att, 'wait', 3, 'hp', r.hp, 'max_hp', r.max_hp, 'team_hp', th, 'team_max', tm,
      'next_dmg', (case when att = 1 and not b.ox then 1 else 0 end) * mul, 'rev', pl.cur_rev, 'pos_ok', case when b.ord then pos_ok end);
  end if;
  st := case when att = 1 then pl.streak + 1 else 0 end;
  dmg := (case when att = 1 then 2 when att = 2 and not b.ox then 1 else 0 end + case when att = 1 and st % 5 = 0 then 1 else 0 end) * mul;
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
    'team_hp', th, 'team_max', tm, 'rev', pl.cur_rev, 'wait', 0, 'ord', b.ord);
end $function$;

create or replace function public.raid_free_summary(p_room text)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.is_teacher() then return null; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('q', b.q,
      'answer', case when b.ord then (select string_agg(x, ' → ' order by k) from jsonb_array_elements_text(b.o) with ordinality t(x, k))
                     when b.ox then (case when b.a = 'true'::jsonb then 'O' else 'X' end) else b.o ->> ((b.a::text)::int) end,
      'e', b.e, 'n', s.n, 'ok', s.ok) order by (s.ok::float / s.n), s.n desc), '[]'::jsonb)
    from (select qid, count(*) n, count(*) filter (where correct) ok from public.raid_free_log where room_id = p_room and attempt = 1 group by qid) s
    join public.raid_bank b on b.id = s.qid);
end $function$;

-- 挑戰上一次的自己：同單元、同模式、同班級的上一場（已結束、不是取消的）
create or replace function public.raid_ghost(p_room text)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare r public.raid_rooms; g public.raid_rooms; st timestamptz; n_pl int; res jsonb;
begin
  if not public.is_teacher() then return null; end if;
  select * into r from public.raid_rooms where id = p_room;
  if r.id is null then return null; end if;
  select * into g from public.raid_rooms x
   where x.id <> r.id and x.game is not distinct from r.game and x.mode = r.mode
     and x.class_name is not distinct from r.class_name and x.status = 'end' and coalesce(x.result,'') <> 'cancel'
     and x.created_at < r.created_at and x.max_hp > 0
     and (x.mode <> 'team' or x.teams = r.teams)
     and exists (select 1 from public.raid_players p where p.room_id = x.id)
   order by x.created_at desc limit 1;
  if g.id is null then return jsonb_build_object('none', true); end if;
  select count(*) into n_pl from public.raid_players where room_id = g.id;
  if g.mode in ('free','team') then
    st := coalesce(g.started_at, (select min(created_at) from public.raid_free_log where room_id = g.id));
    res := jsonb_build_object('room', g.id, 'at', g.created_at, 'mode', g.mode, 'result', g.result, 'players', n_pl, 'max_hp', g.max_hp,
      'end_pct', round((g.max_hp - greatest(0, coalesce(g.hp, 0))) * 100.0 / g.max_hp),
      'acc', (select round(count(*) filter (where correct) * 100.0 / nullif(count(*), 0)) from public.raid_free_log where room_id = g.id and attempt = 1),
      'mins', case when g.ends_at is not null and st is not null then round(extract(epoch from (g.ends_at - st)) / 60) end,
      'win_sec', case when g.result = 'win' then (select round(extract(epoch from (max(created_at) - st))) from public.raid_free_log where room_id = g.id) end,
      'curve', (select coalesce(jsonb_agg(round(c * 100.0 / g.max_hp, 1) order by k), '[]'::jsonb) from (
                 select k, sum(coalesce(d.dmg, 0)) over (order by k) c
                 from generate_series(0, 60) k
                 left join (select floor(extract(epoch from (created_at - st)) / 30)::int b, sum(dmg) dmg
                            from public.raid_free_log where room_id = g.id group by 1) d on d.b = k) z
               where k * 30 <= extract(epoch from (coalesce(g.ends_at, st + interval '30 minutes') - st))));
  else
    res := jsonb_build_object('room', g.id, 'at', g.created_at, 'mode', g.mode, 'result', g.result, 'players', n_pl, 'max_hp', g.max_hp,
      'end_pct', round((g.max_hp - greatest(0, coalesce(g.hp, 0))) * 100.0 / g.max_hp),
      'acc', (select round(count(*) filter (where correct) * 100.0 / nullif(count(*), 0)) from public.raid_answers where room_id = g.id),
      'rounds', (select count(*) from public.raid_rounds where room_id = g.id),
      'curve', (select coalesce(jsonb_agg(round(least(c, g.max_hp) * 100.0 / g.max_hp, 1) order by rd), '[]'::jsonb) from (
                 select rr.round rd, sum(x.ok + case when x.ok * 10 >= n_pl * 8 then ceil(x.ok * 0.5) else 0 end) over (order by rr.round) c
                 from public.raid_rounds rr
                 left join lateral (select count(*) filter (where a.correct) ok from public.raid_answers a where a.room_id = g.id and a.round = rr.round) x on true
                 where rr.room_id = g.id) z));
  end if;
  return res;
end $function$;
