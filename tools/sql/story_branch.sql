-- 2026-11-24 情境挑戰（分支劇情）：記錄結局、可選「這場不記錄」
--   raid_rooms.story_end：大螢幕走到結局時用 raid_story_end 寫入 {id,type,icon,title,path:[{q,pick,best,votes,tot}]}
--   raid_state 多回傳 story_end（結束後平板顯示全班走到的結局）
--   raid_finish：p_result='norec' 時結束房間但不寫 game_results；情境闖關的 data 多帶 ending
alter table public.raid_rooms add column if not exists story_end jsonb;

create or replace function public.raid_story_end(p_room text, p_end jsonb)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_teacher() then return; end if;
  update public.raid_rooms set story_end = p_end, updated_at = now() where id = p_room;
end $$;
revoke all on function public.raid_story_end(text, jsonb) from public;
grant execute on function public.raid_story_end(text, jsonb) to authenticated;

create or replace function public.raid_finish(p_room text, p_result text)
returns void language plpgsql security definer set search_path to '' as $function$
declare r public.raid_rooms; sess text := 'raid:' || p_room; w int;
begin
  if not public.is_teacher() then return; end if;
  update public.raid_rooms set status = 'end', result = p_result, updated_at = now() where id = p_room;
  select * into r from public.raid_rooms where id = p_room;
  if r.id is null or p_result in ('cancel','norec') then return; end if;
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
      jsonb_build_object('mode', r.mode, 'result', p_result, 'story', r.story, 'ending', r.story_end,
        'total', (select count(*) from public.raid_rounds where room_id = p_room),
        'right', (select count(*) from public.raid_answers a where a.room_id = p_room and a.seat = p.seat and a.correct),
        'answered', (select count(*) from public.raid_answers a where a.room_id = p_room and a.seat = p.seat),
        'items', public.raid_items(p_room, p.seat)), now()
    from public.raid_players p where p.room_id = p_room;
  end if;
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
    'story_end', case when r.status = 'end' then r.story_end - 'path' end,
    'my_right', mine, 'my_total', total, 'my_dmg', mydmg);
end $function$;
