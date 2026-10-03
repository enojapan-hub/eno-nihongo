import json, os, re, urllib.request
key = re.search(r"sb_publishable_[A-Za-z0-9_-]+", open("/home/user/pr109/src/integrations/supabase/client.ts").read()).group(0)
U = "https://upxtqsvgppvqpbrjoitz.supabase.co"
def req(path, body=None, tok=None, rng=None):
    h = {"apikey": key, "Content-Type": "application/json"}
    if tok: h["Authorization"] = "Bearer " + tok
    if rng: h["Range"] = rng
    r = urllib.request.Request(U + path, data=json.dumps(body).encode() if body is not None else None, headers=h, method="POST" if body is not None else "GET")
    with urllib.request.urlopen(r, timeout=90) as f: return json.load(f)
tok = req("/auth/v1/token?grant_type=password", {"email": os.environ["E2E_EMAIL"], "password": os.environ["E2E_PASSWORD"]})["access_token"]
def page(path):
    out, i = [], 0
    while True:
        rows = req(path, tok=tok, rng=f"{i}-{i+999}")
        out += rows
        if len(rows) < 1000: return out
        i += 1000
vocab = page("/rest/v1/vocabulary?select=id,level,term,examples&is_published=eq.true&order=id")
senses = page("/rest/v1/vocabulary_senses?select=id,vocabulary_id,examples&order=id")
gram = page("/rest/v1/grammar_points?select=id,level,pattern,examples,wrong_examples&is_published=eq.true&order=id")
lvl = {v["id"]: v["level"] for v in vocab}
rows = []
for v in vocab:
    for i, e in enumerate(v["examples"] or []):
        rows.append({"table": "vocabulary", "owner": v["id"], "idx": i, "level": v["level"], "e": e})
for s in senses:
    if s["vocabulary_id"] not in lvl: continue
    for i, e in enumerate(s["examples"] or []):
        rows.append({"table": "vocabulary_senses", "owner": s["id"], "idx": i, "level": lvl[s["vocabulary_id"]], "e": e})
for g in gram:
    for i, e in enumerate(g["examples"] or []):
        rows.append({"table": "grammar_points", "owner": g["id"], "idx": i, "level": g["level"], "e": e})
json.dump(rows, open("snap/live_pre.json", "w"), ensure_ascii=False)
json.dump([{"id": g["id"], "level": g["level"], "wrong": g["wrong_examples"]} for g in gram], open("snap/wrong_pre.json", "w"), ensure_ascii=False)
print("elements", len(rows), {t: sum(1 for r in rows if r["table"] == t) for t in ("vocabulary", "vocabulary_senses", "grammar_points")})
