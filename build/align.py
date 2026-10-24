import json, collections, re, sys
sys.path.insert(0, '/home/claude/work')
from common import S, C
M = json.load(open('/home/claude/data/morph.json'))
DIAC = re.compile('[ؐ-ًؚ-ٰٟۖ-ۭـ]')
def norm(w):
    w = DIAC.sub('', w)
    w = w.translate(str.maketrans({'ٱ': 'ا', 'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ى': 'ي', 'ة': 'ه', 'ؤ': 'ء', 'ئ': 'ء'}))
    w = w.replace('ا', '').replace('ء', '').replace('ي', '').replace('و', '')
    return re.sub(r'(.)\1+', r'\1', w)
LW = collections.defaultdict(lambda: collections.defaultdict(list))
for s, a, w, seg, form, pos, feat, root, lem in M:
    LW[(s, a)][w].append((seg, form, pos, feat, root, lem))
def words(k):
    s, a = map(int, k.split(':'))
    t = S[k].split(); c = C[k].split()
    if a == 1 and s not in (1, 9) and C[k].startswith('بسم الله الرحمن الرحيم '): t, c = t[4:], c[4:]
    return t, c
def align(k):
    s, a = map(int, k.split(':')); t, c = words(k)
    L = [sorted(LW[(s, a)][w]) for w in sorted(LW[(s, a)])]
    out = []; i = 0; miss = 0
    for idx, segs in enumerate(L):
        lf = ''.join(x[1] for x in segs).replace(' ', '')
        root = next((x[4] for x in segs if x[4]), None); lem = next((x[5] for x in segs if x[2] in ('N', 'V') and x[5]), None)
        if i < len(c) and norm(c[i]) == norm(lf): span = 1
        elif i + 1 < len(c) and norm(c[i] + c[i + 1]) == norm(lf): span = 2
        elif i + 2 < len(c) and norm(c[i] + c[i + 1] + c[i + 2]) == norm(lf): span = 3
        elif (len(c) - i) > (len(L) - idx): span = 2
        else: span = 1; miss += 1 if norm(c[i]).replace('ص', 'س') != norm(lf).replace('ص', 'س') else 0
        out.append((' '.join(t[i:i + span]), root, lem)); i += span
    if i != len(c): miss += 100
    return out, miss
if __name__ == '__main__':
    bad = []
    for k in C:
        o, m = align(k)
        if m: bad.append((k, m))
    print(len(bad), bad[:15])
