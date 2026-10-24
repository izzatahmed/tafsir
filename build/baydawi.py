"""Parse al-Baydawi's Anwar al-Tanzil (OpenITI, version Tafsir01006 from altafsir.com, structured by verse) into per-surah passages."""
import re, json, collections
F = '/home/claude/openiti/0700ah/data/0685NasirDinBaydawi/0685NasirDinBaydawi.AnwarTanzil/0685NasirDinBaydawi.AnwarTanzil.Tafsir01006-ara1'
def parse():
    raw = open(F, encoding='utf-8-sig').read().split('\n')
    P = collections.defaultdict(list); cur = None; buf = []
    def flush():
        if cur:
            txt = ''
            for l in buf:
                if l.startswith('# '): txt += ('\n' if txt else '') + l[2:]
                elif l.startswith('~~'): txt += ' ' + l[2:]
            txt = re.sub(r'\bms\d+\b', '', txt)
            txt = re.sub(r'[ \t]+', ' ', txt).replace(' \n', '\n').strip()
            P[cur[0]].append([cur[1], cur[2], txt])
    for l in raw:
        m = re.match(r'^### \|\| \[(\d+)\.(\d+)(?:-(\d+))?\]', l)
        if m:
            flush(); s, a, b = int(m.group(1)), int(m.group(2)), int(m.group(3) or m.group(2)); cur = (s, a, b); buf = []; continue
        if l.startswith('### |'):
            flush(); cur = None; buf = []; continue
        if cur and (l.startswith('# ') or l.startswith('~~')): buf.append(l)
    flush()
    return P
if __name__ == '__main__':
    import sys; sys.path.insert(0, '/home/claude/work')
    P = parse()
    CH = json.load(open('/home/claude/data/t_risan_quran-json/data/tanzil/chapters.json', encoding='utf-8'))['chapters']
    miss = []; empty = 0; over = []
    for s in range(1, 115):
        n = CH[s - 1]['total_verses']; cov = set()
        for a, b, t in P[s]:
            if not t: empty += 1
            for x in range(a, b + 1):
                if x in cov: over.append((s, x))
                cov.add(x)
        m = [x for x in range(1, n + 1) if x not in cov]
        if m or max(cov) > n: miss.append((s, m[:10], len(m), max(cov), n))
    print('passages', sum(len(v) for v in P.values()), 'empty', empty, 'overlap', len(over), over[:5]); print('missing', len(miss), miss[:20])
    print(P[17][63][2][:400])
