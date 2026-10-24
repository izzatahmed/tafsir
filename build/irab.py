"""Short Arabic morphological/case description of every Quranic word, generated from the Quranic Arabic Corpus (Leeds) tags.
It states each segment's part of speech and grammatical state (case, mood, voice), not its syntactic function."""
import json, re, collections, unicodedata
M = json.load(open('/home/claude/data/morph.json'))

PART = {'P': 'حرف جر', 'CONJ': 'حرف عطف', 'REM': 'حرف استئناف', 'NEG': 'حرف نفي', 'EMPH': 'لام التوكيد', 'PRP': 'لام التعليل',
        'SUB': 'حرف مصدري', 'AMD': 'حرف استدراك', 'ANS': 'حرف جواب', 'AVR': 'حرف ردع', 'CAUS': 'حرف سببية', 'CERT': 'حرف تحقيق',
        'CIRC': 'واو الحال', 'COM': 'واو المعية', 'COND': 'أداة شرط', 'EQ': 'حرف تسوية', 'EXH': 'حرف تحضيض', 'EXL': 'حرف تفصيل',
        'EXP': 'أداة استثناء', 'FUT': 'حرف استقبال', 'INC': 'حرف ابتداء', 'INT': 'حرف تفسير', 'INTG': 'أداة استفهام', 'PREV': 'حرف كافّ',
        'PRO': 'حرف نهي', 'RES': 'أداة حصر', 'RET': 'حرف إضراب', 'RSLT': 'حرف واقع في جواب الشرط', 'SUP': 'حرف زائد', 'SUR': 'حرف فجاءة',
        'VOC': 'حرف نداء', 'INL': 'حروف مقطّعة', 'ADDR': 'حرف خطاب', 'DIST': 'لام البعد', 'ATT': 'ها التنبيه', 'IMPN': 'اسم فعل أمر',
        'DET': 'أداة التعريف', 'T': 'ظرف زمان', 'LOC': 'ظرف مكان', 'DEM': 'اسم إشارة', 'REL': 'اسم موصول'}
CASE = {'NOM': 'مرفوع', 'ACC': 'منصوب', 'GEN': 'مجرور'}
MOOD = {'MOOD:IND': 'مرفوع', 'MOOD:SUBJ': 'منصوب', 'MOOD:JUS': 'مجزوم'}
PERS = {'1S': 'للمتكلم', '1P': 'للمتكلمين', '2MS': 'للمخاطب', '2FS': 'للمخاطبة', '2MP': 'للمخاطبين', '2FP': 'للمخاطبات', '2D': 'للمخاطبَين',
        '2MD': 'للمخاطبَين', '2FD': 'للمخاطبتين', '3MS': 'للغائب', '3FS': 'للغائبة', '3MP': 'للغائبين', '3FP': 'للغائبات', '3D': 'للغائبَين',
        '3MD': 'للغائبَين', '3FD': 'للغائبتين'}
def clean(f):
    f = f.replace('ۡ', 'ْ').replace('ٱ', 'ا')
    f = re.sub('[ۖ-ۜ۟-ۤۧ-ۭ]', '', f)
    return f
def seg_desc(tags, host):
    t = tags[0]; feats = set(tags[1:])
    pers = next((PERS[x] for x in tags if x in PERS), '')
    if t == 'PRON':
        d = 'ضمير ' + ('متصل' if 'SUFF' in feats else 'منفصل') + (' ' + pers if pers else '')
        if 'SUFF' in feats and host == 'N': d += '، في محل جر بالإضافة'
        elif 'SUFF' in feats and host == 'P': d += '، في محل جر'
        return d
    if t in ('PERF', 'IMPF', 'IMPV') and any(x.startswith('VF:') for x in tags):
        d = 'فعل ' + {'PERF': 'ماضٍ', 'IMPF': 'مضارع', 'IMPV': 'أمر'}[t]
        if 'PASS' in feats: d += ' مبني للمجهول'
        m = next((MOOD[x] for x in tags if x in MOOD), '')
        if m: d += ' ' + m
        if 'FAM:كَان' in feats: d += '، من أخوات كان'
        if 'FAM:كَاد' in feats: d += '، من أفعال المقاربة'
        return d
    if t == 'ACC' and 'PREF' not in feats and any(x.startswith('FAM:') for x in tags):
        return 'حرف ناسخ (إنّ وأخواتها)'
    if t == 'ACC':
        return 'حرف نصب'
    if t == 'IMPV':
        return 'لام الأمر'
    if t in PART:
        d = PART[t]
        c = next((CASE[x] for x in tags[1:] if x in CASE), '')
        if t in ('DEM', 'REL', 'T', 'LOC') and c: d += ' ' + c
        return d
    # nouns
    base = {'PN': 'علم', 'ACT_PCPL': 'اسم فاعل', 'PASS_PCPL': 'اسم مفعول', 'VN': 'مصدر'}.get(t, 'صفة' if 'ADJ' in feats else 'اسم')
    c = next((CASE[x] for x in tags[1:] if x in CASE), '')
    d = base + (' ' + c if c else '')
    if 'INDEF' in feats: d += '، نكرة'
    return d

def describe():
    W = collections.defaultdict(lambda: collections.defaultdict(list))
    for s, a, w, seg, form, pos, feat, root, lem in M:
        W[(s, a)][w].append((seg, form, pos, feat.split('|')))
    out = {}
    for (s, a), words in W.items():
        row = []
        for w in sorted(words):
            segs = sorted(words[w])
            stem = next((x for x in segs if 'PREF' not in x[3] and 'SUFF' not in x[3]), None)
            host = stem[2] if stem else ''
            if stem and stem[3][0] in PART or (stem and stem[3][0] in ('ACC', 'NEG', 'P')): host = 'P' if stem[3][0] == 'P' else 'X'
            pprep = any('PREF' in x[3] and x[3][0] == 'P' for x in segs)
            parts = []
            for seg, form, pos, tags in segs:
                if tags[0] == 'DET':
                    continue
                d = seg_desc(tags, host)
                if tags[0] == 'PRON' and 'SUFF' not in tags and pprep: d = d.replace('ضمير منفصل', 'ضمير متصل') + '، في محل جر'
                if 'PREF' in tags or 'SUFF' in tags:
                    parts.append(clean(form) + ': ' + d)
                else:
                    if any(x[3][0] == 'DET' for x in segs) and d.endswith('، نكرة') is False: d += '، معرّف بأل'
                    parts.append(d)
            row.append(' + '.join(parts))
        out[(s, a)] = row
    return out
if __name__ == '__main__':
    D = describe()
    for k in [(17, 64), (1, 2), (2, 6), (36, 78)]:
        print(k, D[k])
    u = collections.Counter(x for v in D.values() for x in v)
    print('unique', len(u), 'words', sum(u.values()))
