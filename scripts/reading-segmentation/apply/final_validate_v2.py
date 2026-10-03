"""Final validator, round 2 (romaji / missing-reading / arti repair round).

Usage (cwd = scripts/reading-segmentation with snap/ + seg2 output present):
  python final_validate_v2.py PRE.json NOW.json master_plan.json final_fix_v2.json seg2_live.json

* DB-diff safety: every element that differs between PRE and NOW must be a planned element,
  and every changed field must equal the planned value (Japanese never changes).
* Reading categories: same rules as final_validate.py; rows whose Reading was repaired or
  recovered in this round (plan reading/hiragana fields + final_fix) are reviewed manually and
  compared against their planned value instead of the automatic segmenter.
"""
import json, re, collections, sys
sys.path.insert(0, '.')
from overrides import OV
pre_p, now_p, plan_p, fix_p, seg_p = sys.argv[1:6]
pre = {(r['table'], r['owner'], r['idx']): r['e'] for r in json.load(open(pre_p))}
now = {(r['table'], r['owner'], r['idx']): r['e'] for r in json.load(open(now_p))}
PLAN = {(p['table'], p['owner'], p['idx']): p['fields'] for p in json.load(open(plan_p))}
REP = {(t, o, i) for t, o, i, _ in json.load(open(fix_p))}
HOLD = {'vocabulary_senses|142383f2', 'vocabulary_senses|d6733540', 'vocabulary_senses|f83202ab'}
HARD = {'aux-conj', 'conj-te', 'prefix', 'adj-nai', 'adj-arimasen', 'aux-beki-rashii-mai', 'pp-compound',
        'node', 'nagara-noun', 'tari-tomo', 'adv-zutsu', 'num-unit', 'num-kata-unit'}

ctr = collections.Counter(); unexp = 0
for k, e in now.items():
    o = pre[k]
    if e == o: ctr['unchanged'] += 1; continue
    ch = [f for f in set(e) | set(o) if e.get(f) != o.get(f)]
    if k in PLAN and all(f in PLAN[k] and e.get(f) == PLAN[k][f]['new'] for f in ch) and not ({'ja', 'jp'} & set(ch)):
        ctr['planned'] += 1
    else: unexp += 1; print('UNEXPECTED', k, ch)
print('elements', len(now), 'same keys', set(pre) == set(now), dict(ctr), 'UNEXPECTED', unexp)
missing_planned = [k for k, fs in PLAN.items() if any(now[k].get(f) != v['new'] for f, v in fs.items())]
print('planned elements not at planned value:', len(missing_planned))

def spaces(t):
    k = 0; S = set()
    for ch in t.strip():
        if ch in ' 　': S.add(k)
        else: k += 1
    return S

cat = collections.Counter(); conj = []
N = [r for r in json.load(open(seg_p)) if r['status'] == 'ok']
for r in N:
    x = r['old']; key = (r['table'], r['owner'], r['idx'])
    if r['table'] + '|' + r['owner'][:8] in HOLD: cat['unresolved-annotation'] += 1; continue
    if '  ' in x or '　' in x: cat['double-space'] += 1
    if re.search(r'[、，。！？] | [、，。！？]', x): cat['punctuation-space'] += 1
    if re.sub(r'\s', '', x) != re.sub(r'\s', '', r['new']): cat['japanese-reading-mismatch'] += 1
    if r['ja'] in OV:
        if key not in REP and re.sub('，', '、', x) != re.sub('，', '、', OV[r['ja']]): cat['manual-differs'] += 1
        continue
    if key in REP: cat['reviewed-repair/recovery (planned value verified)'] += 1; continue
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
