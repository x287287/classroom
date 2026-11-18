#!/usr/bin/env python3
"""把 lessons/data/u2-game-questions.js、u3-game-questions.js 的題庫轉成 SQL，同步到 Supabase 的 raid_bank 表（game 欄位 = u2／u3）。
全班共戰「各自搶攻」模式由伺服器出題、改題，所以改完題庫後要執行：
    python3 tools/bank-to-sql.py > /tmp/bank.sql
再把 /tmp/bank.sql 的內容到 Supabase 執行（請 Claude 用 Supabase 連接器處理）。
預設只「追加」資料庫裡還沒有的題目（以單元＋題目文字比對），不會刪掉舊題目
（raid_free_log.qid 會參照題目編號）。改了既有題目的選項或答案時，加 --update 會依題目文字更新那一題。
只同步一個單元：python3 tools/bank-to-sql.py u3
排序題（ord:1）：o 依正確順序寫，a 存成 [0,1,2,…]。"""
import json, subprocess, pathlib, sys
root = pathlib.Path(__file__).resolve().parent.parent
args = sys.argv[1:]
update = "--update" in args
games = [a for a in args if not a.startswith("--")] or ["u2", "u3"]
def lit(s): return "'" + str(s).replace("'", "''") + "'"
print("begin;")
total = 0
for g in games:
    js = root / f"lessons/data/{g}-game-questions.js"
    out = subprocess.check_output(["node", "-e",
        "global.window={};require(process.argv[1]);process.stdout.write(JSON.stringify(window.GAME_QUESTIONS))", str(js)])
    Q = json.loads(out)
    for q in Q:
        ox = bool(q.get("ox")); od = bool(q.get("ord"))
        o = "null" if ox else lit(json.dumps(q["o"], ensure_ascii=False)) + "::jsonb"
        if ox: a = "'true'::jsonb" if q["a"] else "'false'::jsonb"
        elif od: a = lit(json.dumps(list(range(len(q["o"]))))) + "::jsonb"
        else: a = f"'{int(q['a'])}'::jsonb"
        vals = f"{lit(g)},{lit(q['d'])},{lit(q['q'])},{o},{'true' if ox else 'false'},{'true' if od else 'false'},{a},{lit(q.get('e',''))}"
        print(f"insert into public.raid_bank(game,d,q,o,ox,ord,a,e) select {vals} where not exists (select 1 from public.raid_bank where game = {lit(g)} and q = {lit(q['q'])});")
        if update:
            print(f"update public.raid_bank set d = {lit(q['d'])}, o = {o}, ox = {'true' if ox else 'false'}, ord = {'true' if od else 'false'}, a = {a}, e = {lit(q.get('e',''))} where game = {lit(g)} and q = {lit(q['q'])};")
    print(f"-- {g}: {len(Q)} 題", file=sys.stderr)
print("commit;")
