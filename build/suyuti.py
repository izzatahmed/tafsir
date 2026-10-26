"""Split al-Suyuti's Lubab al-Nuqul fi Asbab al-Nuzul (OpenITI ShamAY0034090) by surah and verse.
Each report begins «قوله تعالى: {...}»; the quoted words are matched to the verse text of the surah."""
import re, json, sys, collections
sys.path.insert(0, '/home/claude/work'); sys.path.insert(0, '/home/claude/mufradat/build')
from common import C
from ukbari import nz, skel, SNAME, CH
F = '/home/claude/openiti/0925ah/data/0911Suyuti/0911Suyuti.LubabNuqul/0911Suyuti.LubabNuqul.ShamAY0034090-ara1'
def surahs():
    raw = open(F, encoding='utf-8-sig').read().split('\n')
    S = collections.OrderedDict(); cur = None
    for l in raw:
        m = re.match(r'^### \|+ (?:AUTO ### \|+ )?CHECK \[(?:سورة )?([^\]]+)\]', l)
        if m:
            name = nz(m.group(1)).strip()
            cur = None
            if name == nz('المعوذتين'): cur = 113
            elif name == nz('ألم نشرح لك'): cur = 94
            else:
                for nm in [x.strip() for x in name.split(' او ')]:
                    nm = re.sub('^اال', 'ال', nm)
                    cur = cur or SNAME.get(nm) or SNAME.get(re.sub('^ال', '', nm))
            if cur: S.setdefault(cur, [])
            continue
        if cur is None: continue
        if l.startswith('### | AUTO '): S[cur].append('\n\x00'); l = '# ' + l[len('### | AUTO '):]   # stray headings mark lost surah starts
        if re.match(r'^# PageV\d+P\d+\s*$', l): continue
        if l.startswith('# '): S[cur].append('\n' + l[2:])
        elif l.startswith('~~'): S[cur].append(' ' + l[2:])
    out = {}
    for s, parts in S.items():
        t = ''.join(parts)
        t = re.sub(r'\bms\d+\b', '', t); t = re.sub(r'PageV\d+P\d+', '', t)
        out[s] = re.sub(r'[ \t]+', ' ', t).replace(' \n', '\n').strip()
    return out
SPLIT = re.compile(r'(?=(?:[قف][وا]?له|قله) تعال[ىي]?\s*:?\s*\{)|\x00')
def split():
    """surah headers are missing for some surahs in the source, so a quote not found in the current surah is looked up in the next few surahs"""
    res = collections.defaultdict(list); st = collections.Counter()
    seq = []
    for s, t in surahs().items():
        for c in SPLIT.split(t):
            if c.strip(): seq.append((s, c.strip()))
    cur = 1; last = 0; prev_hdr = None
    def find(ss, k, start):
        n = CH[ss - 1]['total_verses']
        for a in list(range(max(1, start), n + 1)) + list(range(1, max(1, start))):
            if k in skel(C[f'{ss}:{a}']): return a
        return None
    for hs, c in seq:
        if hs != prev_hdr: prev_hdr = hs; cur = hs; last = 0
        v = None
        for q in re.finditer(r'\{([^}]+)\}', c):
            if v is not None: break
            k = skel(q.group(1))[:14]
            if len(k) >= 3:
                v = find(cur, k, last)
                if v is None:
                    for ss in range(cur + 1, min(115, cur + 6)):
                        v = find(ss, k, 1)
                        if v: cur = ss; last = 0; st['moved'] += 1; break
        if v is None and res[cur]:
            res[cur][-1][1] += '\n' + c; st['appended'] += 1; continue
        if v is None: v = 1; st['unmatched_first'] += 1
        else: st['matched'] += 1
        res[cur].append([v, c]); last = v
    if 113 in res:
        f, n_ = [], []
        for v, c in res[113]:
            (n_ if re.search(r'\{\s*قل أعوذ برب الناس', c) else f).append([v, c])
        res[113] = f or res[113]
    return res, st
if __name__ == '__main__':
    R, st = split()
    print(st, 'surahs', len(R), 'items', sum(len(v) for v in R.values()), 'verses', sum(len({a for a, t in v}) for v in R.values()))
    print(R[2][1][0], R[2][1][1][:200]); print(R[17][0][0], R[17][0][1][:200]); print(sorted(set(range(1,115))-set(R)))
