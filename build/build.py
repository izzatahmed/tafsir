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
formrefs = collections.defaultdict(list)                # normalised form -> 's:a.w' occurrences (w = word index in the verse file)
nwords = 0
for s in range(1, 115):
    n = CH[s - 1]['total_verses']; vs = []
    for a in range(1, n + 1):
        k = f'{s}:{a}'
        al, miss = align(k); assert miss == 0 or k in ('2:245', '7:69'), k
        row = []
        for wi, (w, root, lem) in enumerate(al):
            key = root or ('#' + DIAC.sub('', lem) if lem else '')
            row.append([w, key]); nwords += 1
            if key:
                for part in w.split(' '):
                    forms[nz(part)][key] += 1
                    if not formrefs[nz(part)] or formrefs[nz(part)][-1] != f'{s}:{a}.{wi}': formrefs[nz(part)].append(f'{s}:{a}.{wi}')
                if not roots[key] or roots[key][-1] != k: roots[key].append(k)
        vs.append(row)
    json.dump(vs, open(OUT + f'data/q/{s}.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
assert nwords > 77000
json.dump({f: ','.join(v) for f, v in formrefs.items()}, open(OUT + 'data/forms.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
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

# ---------- Mukhtar al-Sihah (OpenITI) : one file, entries mapped to Leeds roots ----------
from mukhtar import parse as mparse
ME = mparse()
HZ = str.maketrans({'إ': 'أ', 'آ': 'أ', 'ؤ': 'أ', 'ئ': 'أ', 'ء': 'أ', 'ى': 'ي'})
MR = collections.defaultdict(list)
for i, e in enumerate(ME): MR[e['r'].translate(HZ)].append(i)
def mcands(r):
    r = r.translate(HZ); out = list(MR.get(r, []))
    if not out and r[-1] in 'وي': out = MR.get(r[:-1] + 'ا', []) or MR.get(r[:-1] + ('ي' if r[-1] == 'و' else 'و'), [])
    return out
MX = {k: mcands(k) for k in roots if not k.startswith('#') and mcands(k)}
MD = {'H': [e['h'] for e in ME], 'P': [e['p'] for e in ME], 'T': [e['t'] for e in ME], 'R': MX}
open(OUT + 'data/mukhtar.js', 'w', encoding='utf-8').write(
    '/* مختار الصحاح، لزين الدين محمد بن أبي بكر الرازي (ت 666هـ)، تحقيق يوسف الشيخ محمد، المكتبة العصرية، ط5 1420هـ/1999م.\n'
    '   النص من مدونة OpenITI (0666IbnAbiBakrZaynDinRazi.MukhtarSihah.Shamela0023193-ara1) بترخيص CC BY-NC-SA 4.0، ويُنشر هذا الملف المستخرج منه بالترخيص نفسه.\n'
    '   رُبطت المداخل بجذور مدونة القرآن العربية (جامعة ليدز) آلياً. */\nwindow.MUKHTAR=' + json.dumps(MD, ensure_ascii=False, separators=(',', ':')) + ';\n')
tok = sum(len(v) for k, v in roots.items() if k in MX); tot = sum(len(v) for k, v in roots.items() if not k.startswith('#'))

# ---------- short i'rab description per word (from Leeds tags) ----------
from irab import describe
DS = describe(); DU = {}; DV = []
for s in range(1, 115):
    sv = []
    for a in range(1, CH[s - 1]['total_verses'] + 1):
        row = DS[(s, a)]
        q = json.load(open(OUT + f'data/q/{s}.json', encoding='utf-8'))[a - 1] if a == 1 else None
        sv.append([DU.setdefault(x, len(DU)) for x in row])
    DV.append(sv)
for s in range(1, 115):          # word counts must match the verse files
    q = json.load(open(OUT + f'data/q/{s}.json', encoding='utf-8'))
    assert [len(v) for v in q] == [len(v) for v in DV[s - 1]], s
json.dump({'D': list(DU), 'V': DV}, open(OUT + 'data/irab.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

# ---------- al-'Ukbari, al-Tibyan (OpenITI), chunked by surah groups ----------
from ukbari import parse as uparse, assign as uassign
UO, UST = uassign(uparse())
os.makedirs(OUT + 'data/ub', exist_ok=True)
sizes = {s: sum(len(t) for _, _, t in UO.get(s, [])) for s in range(1, 115)}
CHUNKS = []; cur = []; acc = 0; target = sum(sizes.values()) / 12
for s in range(1, 115):
    cur.append(s); acc += sizes[s]
    if acc >= target and len(CHUNKS) < 11: CHUNKS.append(cur); cur = []; acc = 0
if cur: CHUNKS.append(cur)
UBMAP = {}
for i, ch in enumerate(CHUNKS):
    json.dump({str(s): UO.get(s, []) for s in ch}, open(OUT + f'data/ub/{i + 1}.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    for s in ch: UBMAP[s] = i + 1
I = json.load(open(OUT + 'data/index.json', encoding='utf-8'))
I['U'] = [UBMAP[s] for s in range(1, 115)]
json.dump(I, open(OUT + 'data/index.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('mukhtar entries', len(ME), 'roots mapped', len(MX), 'token coverage', round(tok / tot, 3), '| irab unique', len(DU), '| ukbari', dict(UST), 'chunks', len(CHUNKS))
