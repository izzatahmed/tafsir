"""Split al-'Ukbari's al-Tibyan fi I'rab al-Quran (OpenITI Shamela0022928, ed. 'Ali Muhammad al-Bajawi, 'Isa al-Babi al-Halabi) by surah and verse.
Headings in the source quote the verses with their numbers, e.g. «قال تعالى: (ذلك الكتاب ... (2))»."""
import re, json, sys, collections
sys.path.insert(0, '/home/claude/work')
from common import C
F = '/home/claude/openiti/0625ah/data/0616MuhibbDinCukbari/0616MuhibbDinCukbari.TibyanFiIcrabQuran/0616MuhibbDinCukbari.TibyanFiIcrabQuran.Shamela0022928-ara1'
CH = json.load(open('/home/claude/data/t_risan_quran-json/data/tanzil/chapters.json', encoding='utf-8'))['chapters']
DIAC = re.compile('[ً-ٰٟـ]')
def nz(w): return DIAC.sub('', w).translate(str.maketrans({'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ى': 'ي', 'ة': 'ه'})).strip()
SNAME = {}
for c in CH:
    n = nz(c['name']); SNAME[n] = c['id']; SNAME[n.replace('ال', '', 1) if n.startswith('ال') else n] = c['id']
SNAME.update({nz('براءة'): 9, nz('بني إسرائيل'): 17, nz('المؤمن'): 40, nz('حم السجدة'): 41, nz('فصلت'): 41, nz('الدهر'): 76, nz('الملائكة'): 35, nz('القتال'): 47, nz('محمد صلى الله عليه وسلم'): 47, nz('تبارك'): 67, nz('ن'): 68, nz('سأل'): 70, nz('عم'): 78, nz('اقرأ'): 96, nz('تبت'): 111, nz('لم يكن'): 98})
def surah_of(h):
    t = nz(re.sub(r'^سوره\s+', '', nz(h)))
    t = re.sub(r'^[\s\[\(:.]+', '', t); t = re.sub(r'[\s\]\):.]+$', '', t)
    t = re.sub(r'\s*\(.*$', '', t).strip(' :.')
    return SNAME.get(t)
def parse():
    raw = open(F, encoding='utf-8').read().split('\n')
    start = next(i for i, l in enumerate(raw) if l.startswith('### | إعراب الاستعاذة'))
    secs = []; s = 1; cur = None; prevmax = 0
    for l in raw[start:]:
        if l.startswith('### |'):
            h = re.sub(r'\bms\d+\b', '', l[5:]).strip()
            if surah_of(h) and not re.search(r'\(\d', h):
                s = surah_of(h); prevmax = 0; cur = None; continue
            if h.startswith('قال') or h.startswith('(قال') or '(' in h:
                nums = [int(x) for x in re.findall(r'\((\d{1,3})\)', h)]
                if nums and min(nums) < prevmax - 2 and not secs[-1:] == []:
                    pass
                cur = {'s': s, 'h': h, 'n': nums, 't': ''}; secs.append(cur)
                if nums: prevmax = max(nums)
            else:
                sn = surah_of(h)
                if sn: s = sn; prevmax = 0; cur = None
                elif cur is not None: cur['t'] += '\n' + h
            continue
        if cur is None: continue
        if re.match(r'^# PageV\d+P\d+\s*$', l): continue
        if l.startswith('# '): cur['t'] += ('\n' if cur['t'] else '') + l[2:]
        elif l.startswith('~~'): cur['t'] += ' ' + l[2:]
    for x in secs:
        x['t'] = re.sub(r'\s*PageV\d+P\d+\s*', ' ', re.sub(r'\bms\d+\b', '', x['t']))
        x['t'] = re.sub(r'[ \t]+', ' ', x['t']).replace(' \n', '\n').strip()
    return secs
def skel(w): return re.sub(r'(.)\1+', r'\1', nz(w).replace(' ', '').replace('ا', '').replace('و', '').replace('ي', '').replace('ء', '').replace('ؤ', '').replace('ئ', ''))
def assign(secs):
    """give each section a verse range; numbered headings are trusted if the quoted text is found in the verse, otherwise the text decides"""
    out = collections.defaultdict(list); stats = collections.Counter()
    last = collections.defaultdict(int)
    for x in secs:
        s = x['s']; n = CH[s - 1]['total_verses']
        q = re.sub(r'\(\(?\d{1,3}\)?\)', ' ', x['h'].replace('قال تعالى:', ''))
        q = re.sub(r'[().«»\[\]]', ' ', q)
        sq = skel(q)[:24]
        found = None
        if x['n'] and sq and s < 114:
            def hit(ss):
                nn = CH[ss - 1]['total_verses']; a0, b0 = min(x['n']), max(x['n'])
                return b0 <= nn and sq[:12] in skel(' '.join(C[f'{ss}:{v}'] for v in range(max(1, a0 - 1), min(nn, b0) + 1)))
            if not hit(s):
                for ss in (s + 1, s + 2):
                    if ss <= 114 and hit(ss): x['s'] = s = ss; n = CH[s - 1]['total_verses']; stats['advanced'] += 1; break
        if x['n'] and all(1 <= v <= n for v in x['n']):
            a, b = min(x['n']), max(x['n'])
            if sq and any(sq[:12] in skel(' '.join(C[f'{s}:{v}'] for v in range(max(1, a - 1), min(n, b) + 1))) for _ in [0]):
                found = (a, b); stats['num'] += 1
            else:
                found = (a, b); stats['num_unverified'] += 1
        if not found and sq:
            for v in list(range(last[s] + 1, n + 1)) + list(range(1, last[s] + 1)):
                if sq[:12] and sq[:12] in skel(C[f'{s}:{v}']): found = (v, v); stats['text'] += 1; break
        if not found:
            v = min(n, last[s] + 1); found = (v, v); stats['guess'] += 1
        a, b = found
        last[s] = max(last[s], b)
        out[s].append([a, b, x['t']])
    return out, stats
if __name__ == '__main__':
    secs = parse()
    print('sections', len(secs), 'surahs', len({x['s'] for x in secs}))
    out, st = assign(secs)
    print(st)
    cov = {s: len({v for a, b, t in out[s] for v in range(a, b + 1)}) for s in out}
    print('surahs with sections', len(out), 'verses covered', sum(cov.values()))
    print([s for s in range(1, 115) if s not in out])
    print(out[17][30][:2], out[17][30][2][:300])
