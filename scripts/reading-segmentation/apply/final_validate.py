"""Final whole-dataset validator for LIVE example readings.

Inputs (working dir): snap/live_pre.json (pre-write snapshot), snap/live_now.json (fresh fetch),
write_plan.json, final_fix.json and seg2_live.json (= runall2.py output on snap/live_now.json).
Reports DB-diff safety (unexpected changes) and the linguistic categories below. Reviewed manual
sentences (overrides.py) are compared against their reviewed value; conjugation flags are reported
separately because the predictor knows one default reading per kanji (e.g. 引っ -> ひっ, 止める ->
やめる/とどめる) -- each flag was reviewed against Sudachi / the ENO entry reading.
"""
import json, re, collections, sys
sys.path.insert(0, '.')
from overrides import OV

pre = {(r['table'], r['owner'], r['idx']): r['e'] for r in json.load(open('snap/live_pre.json'))}
now = {(r['table'], r['owner'], r['idx']): r['e'] for r in json.load(open('snap/live_now.json'))}
P = {(p['table'], p['owner'], p['idx']): p for p in json.load(open('write_plan.json'))}
REP = {(t, o, i) for t, o, i, _ in json.load(open('final_fix.json'))}
HOLD = {'vocabulary_senses|142383f2', 'vocabulary_senses|d6733540', 'vocabulary_senses|f83202ab'}  # intentional "（が）" usage notes
HARD = {'aux-conj', 'conj-te', 'prefix', 'adj-nai', 'adj-arimasen', 'aux-beki-rashii-mai', 'pp-compound',
        'node', 'nagara-noun', 'tari-tomo', 'adv-zutsu', 'num-unit', 'num-kata-unit'}

ctr = collections.Counter(); unexp = 0
for k, e in now.items():
    o = pre[k]
    if e == o: ctr['unchanged'] += 1; continue
    ch = [f for f in set(e) | set(o) if e.get(f) != o.get(f)]
    rk = 'reading' if 'reading' in e else 'hiragana'
    if ch == [rk] and k in P and e[rk] == P[k]['new']: ctr['spacing-planned'] += 1
    elif ch == [rk] and k in REP: ctr['source-repair'] += 1
    else: unexp += 1; print('UNEXPECTED', k, ch)
print('elements', len(now), 'same keys', set(pre) == set(now), dict(ctr), 'UNEXPECTED', unexp)

def spaces(t):
    k = 0; S = set()
    for ch in t.strip():
        if ch in ' 　': S.add(k)
        else: k += 1
    return S

cat = collections.Counter(); conj = []
N = [r for r in json.load(open('seg2_live.json')) if r['status'] == 'ok']
for r in N:
    x = r['old']; key = (r['table'], r['owner'], r['idx'])
    if r['table'] + '|' + r['owner'][:8] in HOLD: cat['unresolved-annotation'] += 1; continue
    if '  ' in x or '　' in x: cat['double-space'] += 1
    if re.search(r'[、，。！？] | [、，。！？]', x): cat['punctuation-space'] += 1
    if re.sub(r'\s', '', x) != re.sub(r'\s', '', r['new']): cat['japanese-reading-mismatch'] += 1
    if r['ja'] in OV:
        if key not in REP and re.sub('，', '、', x) != re.sub('，', '、', OV[r['ja']]): cat['manual-differs'] += 1
        continue
    if key in REP: continue
    olds, news = spaces(x), spaces(r['new']); rules = {int(o): v for o, v in r['rules'].items()}
    for off in olds - news:
        if off in r['punctadj']: continue
        info = rules.get(off)
        if info is None: cat['invalid-split-inside-token'] += 1
        elif info[0] in HARD or info[0].startswith('lexicalized-ENO'): cat['invalid-lexical/conjugation-split'] += 1
    for off in news - olds:
        info = rules.get(off)
        if info and info[1]: cat['missing-hard-boundary(unsegmented/particle)'] += 1
    for v in r['verbs']:
        if v['status'] == 'mismatch': conj.append((r['table'], r['owner'][:8], r['idx'], v['s'], v['lemma'], v['actual']))
print('validated', len(N), dict(cat))
print('conjugation flags needing review (predictor default-reading limits):', len(conj))
