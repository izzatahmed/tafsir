"""Parse Mukhtar al-Sihah (OpenITI Shamela0023193, ed. Yusuf al-Shaykh Muhammad, al-Maktaba al-'Asriyya 1420/1999) into root entries."""
import re, json, collections
F = '/home/claude/openiti/0675ah/data/0666IbnAbiBakrZaynDinRazi/0666IbnAbiBakrZaynDinRazi.MukhtarSihah/0666IbnAbiBakrZaynDinRazi.MukhtarSihah.Shamela0023193-ara1'
HEAD = re.compile(r'^### \| ((?:[\u0621-\u064A]+ )+[\u0621-\u064A]+)\s*[:.]?\s*$')
def parse():
    lines = open(F, encoding='utf-8').read().split('\n')
    start = next(i for i, l in enumerate(lines) if l.startswith('### | حرف الهمزة'))
    E = []; cur = None; page = None
    for l in lines[start:]:
        m = re.match(r'^# PageV\d+P(\d+)', l)
        if m: page = int(m.group(1)); continue
        h = HEAD.match(re.sub(r' ?ms\d+ ?', ' ', l).rstrip()) if l.startswith('### |') else None
        if h and 2 <= len(h.group(1).replace(' ', '')) <= 5:
            cur = {'h': h.group(1), 'r': h.group(1).replace(' ', '').replace('\u0640', ''), 'p': page, 't': ''}; E.append(cur); continue
        if l.startswith('### |'):
            continue            # chapter headings and stray headings: text continues the current entry
        if cur is None: continue
        if l.startswith('# '): cur['t'] += ('\n' if cur['t'] else '') + l[2:]
        elif l.startswith('~~'): cur['t'] += ' ' + l[2:]
    for e in E:
        t = re.sub(r'\bms\d+\b', '', e['t']); t = re.sub(r'^\s*:\s*', '', t)
        t = re.sub(r'[ \t]+', ' ', t).replace(' \n', '\n').strip()
        e['t'] = t
    return [e for e in E if e['t']]
if __name__ == '__main__':
    E = parse()
    print(len(E), E[5], E[100]['h'], E[100]['t'][:200])
    M = json.load(open('/home/claude/data/morph.json'))
    roots = collections.Counter(x[7] for x in M if x[7])
    HZ = str.maketrans({'إ': 'أ', 'آ': 'أ', 'ؤ': 'أ', 'ئ': 'أ', 'ء': 'أ', 'ى': 'ي'})
    MR = collections.defaultdict(list)
    for i, e in enumerate(E): MR[e['r'].translate(HZ)].append(i)
    def cands(r):
        r = r.translate(HZ); out = list(MR.get(r, []))
        if not out and r[-1] in 'وي': out = MR.get(r[:-1] + 'ا', []) or MR.get(r[:-1] + ('ي' if r[-1] == 'و' else 'و'), [])
        return out
    hit = sum(n for r, n in roots.items() if cands(r)); tot = sum(roots.values())
    print('root coverage', sum(1 for r in roots if cands(r)), len(roots), 'tokens', round(hit / tot, 3))
    print([r for r, n in roots.most_common(400) if not cands(r)][:40])
