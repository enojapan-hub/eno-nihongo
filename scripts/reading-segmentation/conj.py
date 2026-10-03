"""Independent Japanese conjugation rule engine (Group 1/2/3 + い-adjectives).

It derives the expected *stem reading* of a verb/adjective token from the lemma reading, the
conjugation group and the conjugation form, so segmentation can verify that a conjugated surface is
recognised as one lexical unit.  Group comes from the dictionary conjugation class (Sudachi/UniDic
活用型), never from the final kana.  Exceptions are rule-based and documented (Exa-validated)."""
import re, warnings
warnings.filterwarnings('ignore')
from sudachipy import dictionary, tokenizer as _tk
_T = dictionary.Dictionary().create(_tk.Tokenizer.SplitMode.C)

def k2h(s):
    return ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' else c for c in s)

ROWS = {  # dictionary ending -> (a, i, u, e, o)
    'う': 'わいうえお', 'く': 'かきくけこ', 'ぐ': 'がぎぐげご', 'す': 'さしすせそ', 'つ': 'たちつてと',
    'ぬ': 'なにぬねの', 'ぶ': 'ばびぶべぼ', 'む': 'まみむめも', 'る': 'らりるれろ',
}
ONBIN = {'う': 'っ', 'つ': 'っ', 'る': 'っ', 'む': 'ん', 'ぶ': 'ん', 'ぬ': 'ん', 'く': 'い', 'ぐ': 'い'}
HONORIFIC_I = {'ござる', 'くださる', 'なさる', 'いらっしゃる', 'おっしゃる', '仰る', '下さる', '為さる', '御座る'}

# Written readings that differ from the UniDic pronunciation reading (言う→ゆう) or have several
# readings depending on the compound; every variant is accepted when verifying a stem.
READING_VARIANTS = {
    '言う': ['いう'], '込む': ['こむ'], '入る': ['はいる', 'いる'], '開く': ['ひらく', 'あく'], '描く': ['えがく', 'かく'],
    '引く': ['ひく'], '降りる': ['おりる'], '替える': ['かえる'], '換える': ['かえる'], '堪える': ['こたえる', 'たえる'],
    '得る': ['える', 'うる'], '好く': ['すく', 'このく'], '行う': ['おこなう'], '辛い': ['からい', 'つらい'],
    '難い': ['にくい', 'がたい', 'かたい'], '深い': ['ふかい'], '突く': ['つく'], '張る': ['はる'], '止まる': ['とまる'],
    '留まる': ['とまる', 'とどまる'], '良い': ['よい', 'いい'], 'いい': ['いい', 'よい'], '可愛い': ['かわいい'],
    '重い': ['おもい'], '空く': ['あく', 'すく'], '生きる': ['いきる'], '上る': ['のぼる', 'あがる'], '下る': ['くだる', 'さがる'],
    '行く': ['いく', 'ゆく'], '来る': ['くる'], '見る': ['みる'], '為る': ['する'],
}
_cache = {}
def lemma_reading(lemma):
    if lemma in _cache:
        return _cache[lemma]
    r = ''.join(k2h(m.reading_form()) for m in _T.tokenize(lemma))
    _cache[lemma] = r
    return r

def lemma_readings(lemma):
    out = [lemma_reading(lemma)]
    for r in READING_VARIANTS.get(lemma, []):
        if r not in out: out.append(r)
    return [r for r in out if r]

def _rend(x):
    # compare modulo rendaku/semi-voicing of the first kana (立ち止まり=どまり, 引っ張る=ぱる)
    if not x: return x
    f = x[0]
    m = {'が': 'か', 'ぎ': 'き', 'ぐ': 'く', 'げ': 'け', 'ご': 'こ', 'ざ': 'さ', 'じ': 'し', 'ず': 'す', 'ぜ': 'せ', 'ぞ': 'そ',
         'だ': 'た', 'ぢ': 'ち', 'づ': 'つ', 'で': 'て', 'ど': 'と', 'ば': 'は', 'び': 'ひ', 'ぶ': 'ふ', 'べ': 'へ', 'ぼ': 'ほ',
         'ぱ': 'は', 'ぴ': 'ひ', 'ぷ': 'ふ', 'ぺ': 'へ', 'ぽ': 'ほ'}
    return m.get(f, f) + x[1:]

def verify_verb(lemma, p4, p5, actual):
    """True if the token reading `actual` is a valid conjugated stem of `lemma` for form p5.
    returns (status, rule, expected-candidates)"""
    cands = []; rule = None; reason = None
    for lr in lemma_readings(lemma):
        e, r = expected_verb_stem(lemma, p4, p5, lr)
        if e is not None:
            cands.append(e); rule = rule or r
        else:
            reason = reason or r
    # extra accepted variants (documented exceptions)
    g = group_of(p4)
    if g == 1 and p5 == '命令形' and lemma in ('なさる', 'いらっしゃる', 'おっしゃる', 'くださる', '仰る', '下さる'):
        cands += [lemma_reading(lemma)[:-1] + 'い']; rule = 'G1-honorific-imperative'
    if g == 2 and p5 == '命令形':
        cands += [c for c in [x[:-1] for x in [lemma_reading(lemma)]]] + [lemma_reading(lemma)[:-1] + 'よ']
        rule = rule or 'G2-imperative-variant'
    if g == 3 and p4 == 'サ行変格' and p5 == '命令形':
        cands += ['しろ', 'せよ', 'し']; rule = 'G3-suru-imperative'
    if g == 3 and lemma.endswith('ずる'):
        base = lemma_reading(lemma)[:-2]
        cands += [base + 'じ', base + 'ぜ', base + 'ず', base + 'ずる', base + 'じよ']; rule = 'G3-zuru'
    if g in (1, 2) and lemma_reading(lemma).endswith('す') is False and False: pass
    if not cands: return 'unchecked:' + (reason or 'no-rule'), rule, []
    ok = any(_rend(actual) == _rend(c) for c in cands) if actual is not None else None
    return ('ok' if ok else ('unresolved-span' if ok is None else 'mismatch')), rule, cands

def group_of(p4):
    if p4.startswith('五段'): return 1
    if p4.startswith('上一段') or p4.startswith('下一段'): return 2
    if p4 in ('サ行変格', 'カ行変格'): return 3
    return 0

def expected_verb_stem(lemma, p4, p5, d=None):
    """returns (expected reading, rule label) or (None, reason)"""
    d = d or lemma_reading(lemma)
    g = group_of(p4)
    if not d: return None, 'no-lemma-reading'
    if p5.startswith('終止形') or p5.startswith('連体形'):
        return d, 'dictionary'
    last = d[-1]
    if g == 3:
        suru = p4 == 'サ行変格'
        tab = {'未然形-一般': 'し', '未然形-サ': 'さ', '未然形-セ': 'せ', '連用形-一般': 'し', '仮定形-一般': 'すれ',
               '命令形': 'しろ', '意志推量形': 'しよう'}
        tabk = {'未然形-一般': 'こ', '連用形-一般': 'き', '仮定形-一般': 'くれ', '命令形': 'こい', '意志推量形': 'こよう'}
        base = d[:-2] if suru else d[:-2]
        if suru and d.endswith('する'):
            e = tab.get(p5)
            if p5 == '命令形' : return None, 'imperative-variant'
            return (base + e, 'G3-suru') if e else (None, 'G3-form-' + p5)
        if (not suru) and d.endswith('くる'):
            e = tabk.get(p5)
            return (d[:-2] + e, 'G3-kuru') if e else (None, 'G3-form-' + p5)
        return None, 'G3-unknown-lemma'
    if g == 2:
        if last != 'る': return None, 'G2-not-ru'
        stem = d[:-1]
        tab = {'未然形-一般': stem, '連用形-一般': stem, '仮定形-一般': stem + 'れ', '命令形': stem + 'ろ', '意志推量形': stem + 'よう', '語幹-一般': stem}
        e = tab.get(p5)
        return (e, 'G2') if e is not None else (None, 'G2-form-' + p5)
    if g == 1:
        if last not in ROWS: return None, 'G1-bad-ending'
        a, i, u, e, o = ROWS[last]
        stem = d[:-1]
        if p5 == '未然形-一般': return stem + a, 'G1-a'
        if p5 == '連用形-一般':
            return stem + i, 'G1-i'
        if p5.startswith('連用形-') and 'イ音便' in p5:
            if lemma in HONORIFIC_I or d in {k2h(x) for x in HONORIFIC_I} or d.endswith(('ござる', 'くださる', 'なさる', 'いらっしゃる', 'おっしゃる')):
                return stem + 'い', 'G1-honorific-i'
            return stem + 'い', 'G1-onbin-i'
        if p5 == '連用形-促音便':
            if d.endswith('いく') and last == 'く': return stem + 'っ', 'G1-iku-exception'
            return stem + 'っ', 'G1-onbin-tsu'
        if p5 == '連用形-撥音便': return stem + 'ん', 'G1-onbin-n'
        if p5 == '連用形-ウ音便': return stem + 'う', 'G1-onbin-u'
        if p5 == '仮定形-一般': return stem + e, 'G1-e'
        if p5 == '命令形':
            if d.endswith('くださる'): return stem + 'い', 'G1-kudasai-imperative'
            return stem + e, 'G1-e'
        if p5 == '意志推量形': return stem + o + 'う', 'G1-o'
        return None, 'G1-form-' + p5
    return None, 'no-group'

def expected_adj_stem(lemma, p5):
    d = lemma_reading(lemma)
    if lemma in ('良い', 'いい', '好い', '宜しい') and d in ('いい', 'よい'):
        d = 'よい'
    if not d.endswith('い'): return None, 'adj-not-i'
    stem = d[:-1]
    tab = {'終止形-一般': d, '連体形-一般': d, '語幹-一般': stem, '連用形-一般': stem + 'く', '連用形-促音便': stem + 'かっ',
           '仮定形-一般': stem + 'けれ', '未然形-補助': stem + 'かろ'}
    e = tab.get(p5)
    if lemma in ('良い', 'いい', '好い') and p5 in ('終止形-一般', '連体形-一般'):
        return None, 'ii-dictionary-variant'
    return (e, 'adj') if e is not None else (None, 'adj-form-' + p5)
