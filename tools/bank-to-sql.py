#!/usr/bin/env python3
"""把 lessons/data/u2-game-questions.js 的題庫轉成 SQL，同步到 Supabase 的 raid_bank 表。
全班共戰「各自搶攻」模式由伺服器出題、改題，所以改完題庫後要執行：
    python3 tools/bank-to-sql.py > /tmp/bank.sql
再把 /tmp/bank.sql 的內容到 Supabase 執行（請 Claude 用 Supabase 連接器處理）。
不要在有人正在玩「各自搶攻」時執行（題目編號會重新產生）。"""
import json, subprocess, pathlib, sys
root = pathlib.Path(__file__).resolve().parent.parent
js = root / "lessons/data/u2-game-questions.js"
out = subprocess.check_output(["node", "-e",
    "global.window={};require(process.argv[1]);process.stdout.write(JSON.stringify(window.GAME_QUESTIONS))", str(js)])
Q = json.loads(out)
def lit(s): return "'" + str(s).replace("'", "''") + "'"
rows = []
for q in Q:
    ox = bool(q.get("ox"))
    o = "null" if ox else lit(json.dumps(q["o"], ensure_ascii=False)) + "::jsonb"
    a = ("'true'::jsonb" if q["a"] else "'false'::jsonb") if ox else f"'{int(q['a'])}'::jsonb"
    rows.append(f"('u2',{lit(q['d'])},{lit(q['q'])},{o},{'true' if ox else 'false'},{a},{lit(q.get('e',''))})")
print("begin;")
print("delete from public.raid_bank where game = 'u2';")
print("insert into public.raid_bank(game,d,q,o,ox,a,e) values\n" + ",\n".join(rows) + ";")
print("commit;")
print(f"-- {len(Q)} 題", file=sys.stderr)
