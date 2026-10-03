"""ENO vocabulary / grammar lexicon used to recognise lexical units (offline segmentation tool)."""
import json, os, re, sys, warnings
warnings.filterwarnings('ignore')
sys.path.insert(0, '.')
from core import tokenize, clean_ja

BAD = re.compile(r'[／〜～\s（）…。！？、「」/,，.:：・\d]')
CASE_PARTICLES = {'を', 'が', 'に', 'で', 'は', 'も', 'の', 'と', 'へ', 'から', 'まで', 'より'}

# Compound case particles (複合格助詞) validated against the learner-grammar literature (庵他 2001,
# 山田 2001, 山崎・藤田 2001): they function as one postposition. Kana variants included.
COMPOUND_CASE = [
    'に対して', 'にたいして', 'について', 'に関して', 'にかんして', 'によって', 'において', 'にとって', 'として',
    'にかけて', 'にわたって', 'に応じて',
    'にしたがって', 'に従って', 'につれて', 'に際して', 'にさいして', 'に先立って', 'にさきだって', 'に伴って',
    'に基づいて', 'にもとづいて', 'に比べて', 'にくらべて', 'によると', 'からすると', 'からすれば',     'に代わって', 'にかわって', 'に加えて', 'にくわえて', 'に反して', 'に沿って', 'にそって',
    'に向かって', 'にむかって', 'に対する', 'に関する', 'による', 'における',
]

def _terms():
    return json.load(open('vocab_full.json'))

def build(force=False):
    path = 'eno_lex.json'
    if os.path.exists(path) and not force:
        return json.load(open(path))
    voc_surf, voc_lemkey, voc_lemma, sahen_nouns = {}, {}, {}, set()
    for v in _terms():
        t = (v['term'] or '').strip()
        if not t or BAD.search(t) or len(t) > 12:
            continue
        ts, _ = tokenize(clean_ja(t))
        ts = [x for x in ts if x['pos'] not in ('補助記号', '空白')]
        if not ts:
            continue
        meta = {'pos': v['part_of_speech'], 'level': v['level']}
        if len(ts) == 1:
            x = ts[0]
            if x['pos'] in ('動詞', '形容詞'):
                voc_lemma[x['lemma']] = meta['pos']
            elif x['pos'] == '名詞' and x['p3'] in ('サ変可能', 'サ変形状詞可能'):
                sahen_nouns.add(x['s'])
            continue
        if any(x['pos'] == '助詞' for x in ts):
            continue
        voc_surf[t] = meta
        verbs = [i for i, x in enumerate(ts) if x['pos'] in ('動詞', '形容詞') and not x['lemma'] in ('ます',)]
        if verbs:
            k = verbs[-1] if ts[verbs[-1]]['p2'] != '非自立可能' else verbs[0] if ts[verbs[0]]['p2'] != '非自立可能' else verbs[-1]
            # main verb = last verb token not followed by another verb token
            k = max(i for i in verbs)
            key = ''.join(x['s'] for x in ts[:k]) + ts[k]['lemma']
            voc_lemkey[key] = meta
            # noun part of a noun+suru verb is a verbal noun ENO teaches as a verb
            if ts[k]['lemma'] in ('する', 'できる') and k == 1 and ts[0]['pos'] == '名詞':
                sahen_nouns.add(ts[0]['s'])
    out = {'voc_surf': voc_surf, 'voc_lemkey': voc_lemkey, 'voc_lemma': voc_lemma, 'sahen_nouns': sorted(sahen_nouns)}
    json.dump(out, open(path, 'w'), ensure_ascii=False)
    return out

if __name__ == '__main__':
    d = build(force=True)
    print({k: len(v) for k, v in d.items()})
    print([k for k in d['voc_lemkey'] if k.endswith('する')][:20])
    print(list(d['voc_surf'])[:30])
    print([n for n in d['sahen_nouns'] if n in ('勉強', '確認', '説明', '練習')])
