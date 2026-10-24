"""Build the data files of the Mufradat site (al-Raghib + gharib + Jalalayn + al-Baydawi).
usage: python3 build.py <site_dir>"""
import json, re, os, sys, shutil, collections
sys.path.insert(0, '/home/claude/mufradat/build'); sys.path.insert(0, '/home/claude/work')
from align import align, words
from common import S, C

OUT = sys.argv[1].rstrip('/') + '/'
SRC = '/home/claude/tafsir_src/'
for d in ['data/q', 'data/jal', 'data/bay', 'data/gh']:
    os.makedirs(OUT + d, exist_ok=True)
CH = json.load(open('/home/claude/data/t_risan_quran-json/data/tanzil/chapters.json', encoding='utf-8'))['chapters']
assert len(CH) == 114
DIAC = re.compile('[ؐ-ًؚ-ٰٟۖ-ۭـ]')
def nz(w):
    """search normalisation; mirrored in app.js nz()"""
    w = DIAC.sub('', w)
    return w.translate(str.maketrans({'ٱ': 'ا', 'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ى': 'ي', 'ة': 'ه', 'ؤ': 'و', 'ئ': 'ي'}))

# ---------- Quran text with root per word ----------
forms = collections.defaultdict(collections.Counter)    # normalised form -> Counter(key)
roots = collections.defaultdict(list)                   # key -> verse refs
nwords = 0
for s in range(1, 115):
    n = CH[s - 1]['total_verses']; vs = []
    for a in range(1, n + 1):
        k = f'{s}:{a}'
        al, miss = align(k); assert miss == 0 or k in ('2:245', '7:69'), k
        row = []
        for w, root, lem in al:
            key = root or ('#' + DIAC.sub('', lem) if lem else '')
            row.append([w, key]); nwords += 1
            if key:
                for part in w.split(' '):
                    forms[nz(part)][key] += 1
                if not roots[key] or roots[key][-1] != k: roots[key].append(k)
        vs.append(row)
    json.dump(vs, open(OUT + f'data/q/{s}.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
assert nwords > 77000
FORMS = {f: [k for k, _ in c.most_common()] for f, c in forms.items()}
# root occurrence index, refs grouped by surah: "s:a.a.a;s:a"
def pack(refs):
    g = collections.OrderedDict()
    for r in refs:
        s, a = r.split(':'); g.setdefault(s, []).append(a)
    return ';'.join(s + ':' + '.'.join(v) for s, v in g.items())
ROOTS = {k: pack(v) for k, v in roots.items()}
# extra key -> al-Raghib entries, for keys the encyclopedia map lacks: exact headword match only (no guessing)
_rs = open('/home/claude/site77/assets/raghib.js', encoding='utf-8').read()
RG = json.loads(_rs[_rs.index('{'):_rs.rstrip().rstrip(';').rindex('}') + 1])
HN = collections.defaultdict(list)
for i, h in enumerate(RG['H']): HN[nz(h)].append(i)
X = {}
for k in roots:
    if k.startswith('#'):
        l = nz(k[1:])
        if l in RG['N']: continue
        c = HN.get(l) or HN.get(re.sub('^ال', '', l))
    else:
        if k in RG['R']: continue
        c = HN.get(nz(k))
    if c: X[k] = c
# exact headword matches reviewed by hand: keep only those where the entry is about the same word
KEEP = {'#ما', '#إذا', '#مع', '#أ', '#ذو', '#أين', '#ثم', '#كم', '#متى', '#أنى', '#لدى', '#هيهات', '#روم', '#اللات', '#لظى'}
X = {k: v for k, v in X.items() if k in KEEP}
X['#هنا'] = [RG['H'].index('هنا')]; X['#وي'] = [i for i, h in enumerate(RG['H']) if h == 'وي' and RG['T'][i].startswith('وي كلمة')]
assert len(X) == 17 and len(X['#وي']) == 1
SUR = [[c['name'], c['transliteration'], c['total_verses'], c['type'][0]] for c in CH]
json.dump({'S': SUR, 'F': FORMS, 'R': ROOTS, 'X': X}, open(OUT + 'data/index.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

# ---------- Jalalayn (Tanzil) ----------
J = collections.defaultdict(dict)
for line in open(SRC + 'jal.txt', encoding='utf-8'):
    if line.startswith('#') or not line.strip(): continue
    s, a, t = line.rstrip('\n').split('|', 2); J[int(s)][int(a)] = t.strip()
assert sum(len(v) for v in J.values()) == 6236
for s in range(1, 115):
    json.dump([J[s][a] for a in range(1, CH[s - 1]['total_verses'] + 1)], open(OUT + f'data/jal/{s}.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

# ---------- al-Baydawi (OpenITI, altafsir.com text structured by verse) : [[from, to, text], ...] ----------
from baydawi import parse as bparse
BP = bparse(); nb = 0
for s in range(1, 115):
    out = BP[s]; n = CH[s - 1]['total_verses']
    cov = [x for a, b, t in out for x in range(a, b + 1)]
    assert cov == list(range(1, n + 1)), s
    nb += len(out)
    json.dump(out, open(OUT + f'data/bay/{s}.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

# ---------- al-Muyassar fi Gharib al-Quran (QUL) : {ayah: text} ----------
ng = 0
for s in range(1, 115):
    d = json.load(open(SRC + f'al-muyassar-fi-al-gharib/{s}.json', encoding='utf-8'))
    d = d['ayahs'] if isinstance(d, dict) else d
    g = {}
    for x in d:
        t = x['text'].strip()
        # Uthmanic Hafs marks -> standard marks, so ordinary Arabic fonts render the glossed words
        t = t.replace('\u06E1', '\u0652').replace('ٱ', 'ا').replace('\u06E5', '').replace('\u06E6', '')
        t = re.sub('[\u06D6-\u06DC\u06DF-\u06E4\u06E7-\u06ED]', '', t)
        t = re.sub('[\u2060\u200c\u200d]', '', t); t = re.sub(r'(?:\u0640|\s|\u200a)\u0670', 'ا', t).replace('\u200a', '').translate({0x08F0: 0x064B, 0x08F1: 0x064C, 0x08F2: 0x064D})
        if t: g[str(x['ayah'])] = t
    ng += len(g)
    json.dump(g, open(OUT + f'data/gh/{s}.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

# ---------- al-Raghib: reuse the encyclopedia's file ----------
shutil.copy('/home/claude/site77/assets/raghib.js', OUT + 'data/raghib.js')
print('extra', len(X), 'words', nwords, 'forms', len(FORMS), 'keys', len(ROOTS), 'baydawi passages', nb, 'gharib verses', ng)
