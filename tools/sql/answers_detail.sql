-- 2026-11-20 後台看得到學生選了什麼、正確答案是什麼：
-- raid_free_log 多記 choice（學生選的選項文字），game_results 的 items 每題多了 w（答錯時選的答案，依序）與 r（正確答案）。
alter table public.raid_free_log add column if not exists choice text;

-- 把作答（選項編號、O／X、排序陣列）換成文字
create or replace function public.raid_choice_text(q jsonb, c jsonb)
returns text language sql immutable set search_path to '' as $f$
  select case
    when c is null or c = 'null'::jsonb then null
    when jsonb_typeof(c) = 'array' then (select string_agg(q->'o'->>((x::text)::int), ' → ' order by k) from jsonb_array_elements(c) with ordinality t(x, k))
    when coalesce(q->>'ox','') in ('1','true') then case when (c::text)::int = 0 then 'O' else 'X' end
    else q->'o'->>((c::text)::int) end
$f$;

-- 一個座號在一場全班共戰的逐題紀錄
create or replace function public.raid_items(p_room text, p_seat integer)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare r public.raid_rooms;
begin
  select * into r from public.raid_rooms where id = p_room;
  if r.mode in ('free','team') then
    return (select coalesce(jsonb_agg(jsonb_build_object('q', b.q, 'ok', q.first_ok, 'tries', q.tries, 'done', q.done,
        'w', q.w,
        'r', case when b.ord then (select string_agg(x, ' → ' order by k) from jsonb_array_elements_text(b.o) with ordinality t(x, k))
                  when b.ox then (case when b.a = 'true'::jsonb then 'O' else 'X' end) else b.o ->> ((b.a::text)::int) end
      ) order by q.first_at), '[]'::jsonb)
      from (select qid, bool_or(correct and attempt = 1) first_ok, bool_or(correct) done, max(attempt) tries, min(id) first_at,
                   coalesce(jsonb_agg(choice order by id) filter (where not correct and choice is not null), '[]'::jsonb) w
            from public.raid_free_log l where l.room_id = p_room and l.seat = p_seat group by qid) q
      join public.raid_bank b on b.id = q.qid);
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'q', case when rr.question ? 's' then (rr.question->>'s') || '（' || (rr.question->>'q') || '）' else rr.question->>'q' end, /* 情境闖關把情境放進題目 */
      'ok', coalesce(a.correct,false), 'skip', a.seat is null,
      'w', case when a.seat is null or a.correct then '[]'::jsonb else jsonb_build_array(public.raid_choice_text(rr.question, a.choice)) end,
      'r', public.raid_choice_text(rr.question, rr.answer->'a')) order by rr.round), '[]'::jsonb)
    from public.raid_rounds rr left join public.raid_answers a on a.room_id = rr.room_id and a.round = rr.round and a.seat = p_seat
    where rr.room_id = p_room);
end $function$;
revoke all on function public.raid_items(text, integer) from public, anon;

create or replace function public.raid_free_answer(p_room text, p_seat integer, p_device text, p_qid integer, p_choice integer default null, p_order integer[] default null)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare r public.raid_rooms; pl public.raid_players; b public.raid_bank; ok boolean; right_idx int; dmg int := 0; st int; newhp int; right_text text; att int;
  th int; tm int; mul int; n int; pos_ok int := 0; i int; ch text;
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
    select string_agg(b.o ->> ((pl.cur_order -> p_order[k])::text)::int, ' → ' order by k) into ch from generate_series(1, n) k;
    select string_agg(x, ' → ' order by k) into right_text from jsonb_array_elements_text(b.o) with ordinality t(x, k);
  else
    if p_choice is null or p_choice < 0 or p_choice > 5 or p_choice = any(pl.cur_wrong) then return jsonb_build_object('err','bad_choice'); end if;
    if b.ox then right_idx := case when b.a = 'true'::jsonb then 0 else 1 end;
    else select (k - 1)::int into right_idx from jsonb_array_elements(pl.cur_order) with ordinality t(x, k) where (x::text)::int = (b.a::text)::int; end if;
    ok := p_choice = right_idx;
    ch := case when b.ox then (case when p_choice = 0 then 'O' else 'X' end) else b.o ->> ((pl.cur_order -> p_choice)::text)::int end;
    right_text := case when b.ox then (case when right_idx = 0 then 'O' else 'X' end) else b.o ->> ((b.a::text)::int) end;
  end if;
  att := pl.tries + 1;
  mul := case when pl.cur_rev then 2 else 1 end;
  if r.mode = 'team' and pl.team is not null and r.team_hp is not null then th := r.team_hp[pl.team]; tm := r.team_max[pl.team]; end if;
  if not ok then
    update public.raid_players set tries = att, cur_wrong = case when b.ord then cur_wrong else array_append(cur_wrong, p_choice) end,
      streak = 0, next_at = now() + interval '3 seconds'
    where room_id = p_room and seat = p_seat;
    insert into public.raid_free_log(room_id, seat, qid, correct, dmg, attempt, choice) values (p_room, p_seat, p_qid, false, 0, att, ch);
    return jsonb_build_object('correct', false, 'attempt', att, 'wait', 3, 'hp', r.hp, 'max_hp', r.max_hp, 'team_hp', th, 'team_max', tm,
      'next_dmg', (case when att = 1 and not b.ox then 1 else 0 end) * mul, 'rev', pl.cur_rev, 'pos_ok', case when b.ord then pos_ok end);
  end if;
  st := case when att = 1 then pl.streak + 1 else 0 end;
  dmg := (case when att = 1 then 2 when att = 2 and not b.ox then 1 else 0 end + case when att = 1 and st % 5 = 0 then 1 else 0 end) * mul;
  update public.raid_players set cur_q = null, cur_order = null, tries = 0, cur_wrong = '{}', seen = array_append(seen, p_qid), streak = st, next_at = now(), cur_rev = false
  where room_id = p_room and seat = p_seat;
  insert into public.raid_free_log(room_id, seat, qid, correct, dmg, attempt, choice) values (p_room, p_seat, p_qid, true, dmg, att, ch);
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
        'items', public.raid_items(p_room, p.seat)), now()
    from public.raid_players p
    left join lateral (
      select count(*) total, count(*) filter (where q.first_ok) first_ok, count(*) filter (where q.done) done, sum(q.dmg) dmg
      from (select qid, bool_or(correct and attempt = 1) first_ok, bool_or(correct) done, sum(dmg) dmg
            from public.raid_free_log l where l.room_id = p_room and l.seat = p.seat group by qid) q) s on true
    where p.room_id = p_room;
  else
    insert into public.game_results(game, title, class_name, seat, device, session, data, created_at)
    select coalesce(r.game,'u2') || case when r.mode = 'story' then '-story' else '-raid' end,
      case when r.mode = 'story' then '情境闖關' else '全班共戰・同步作答' end, r.class_name, p.seat, p.device, sess,
      jsonb_build_object('mode', r.mode, 'result', p_result, 'story', r.story,
        'total', (select count(*) from public.raid_rounds where room_id = p_room),
        'right', (select count(*) from public.raid_answers a where a.room_id = p_room and a.seat = p.seat and a.correct),
        'answered', (select count(*) from public.raid_answers a where a.room_id = p_room and a.seat = p.seat),
        'items', public.raid_items(p_room, p.seat)), now()
    from public.raid_players p where p.room_id = p_room;
  end if;
end $function$;

-- 已經存在的全班共戰紀錄也補上正確答案（同步作答、情境闖關也補上學生選的答案；各自搶攻以前沒有記學生選什麼）
update public.game_results g set data = jsonb_set(g.data, '{items}', public.raid_items(substr(g.session, 6), g.seat))
 where g.session like 'raid:%' and g.seat is not null and exists (select 1 from public.raid_rooms r where r.id = substr(g.session, 6));
