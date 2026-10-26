/* مفردات القرآن الكريم — static single-page app. Data files are built by build/build.py. */
(function () {
  'use strict';
  var app = document.getElementById('app');
  var IDX = null, RG = null, cache = { q: {}, jal: {}, bay: {}, gh: {} };
  var DIAC = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
  var MAP = { 'ٱ': 'ا', 'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ى': 'ي', 'ة': 'ه', 'ؤ': 'و', 'ئ': 'ي' };
  function nz(w) { return (w || '').replace(DIAC, '').replace(/[ٱأإآىةؤئ]/g, function (c) { return MAP[c]; }).trim(); }
  function sk(w) { return nz(w).replace(/[\sاويء]/g, '').replace(/(.)\1+/g, '$1'); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  var AR = '٠١٢٣٤٥٦٧٨٩';
  function an(n) { return String(n).replace(/\d/g, function (d) { return AR[d]; }); }
  function ayat(n) { return n === 1 ? 'آية واحدة' : n === 2 ? 'آيتين' : an(n) + (n % 100 >= 3 && n % 100 <= 10 ? ' آيات' : ' آية'); }
  function suwar(n) { return n === 1 ? 'سورة واحدة' : n === 2 ? 'سورتين' : an(n) + (n % 100 >= 3 && n % 100 <= 10 ? ' سور' : ' سورة'); }

  function getJSON(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }); }
  function loadIdx() { return IDX ? Promise.resolve(IDX) : getJSON('data/index.json').then(function (d) { IDX = d; buildMaps(); return d; }); }
  var rgP = null;
  function loadRG() {
    if (RG) return Promise.resolve(RG);
    if (rgP) return rgP;
    rgP = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = 'data/raghib.js?v=1';
      s.onload = function () { RG = window.RAGHIB; RG.HN = {}; RG.H.forEach(function (h, i) { (RG.HN[nz(h)] = RG.HN[nz(h)] || []).push(i); }); res(RG); };
      s.onerror = function () { rgP = null; rej(new Error('raghib.js')); };
      document.head.appendChild(s);
    });
    return rgP;
  }
  function miss(e) { console.warn(e); return null; }
  var MK = null, mkP = null, IR = null, irP = null, UB = {};
  function loadMK() {
    if (MK) return Promise.resolve(MK); if (mkP) return mkP;
    mkP = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = 'data/mukhtar.js?v=1';
      s.onload = function () { MK = window.MUKHTAR; res(MK); }; s.onerror = function () { mkP = null; rej(new Error('mukhtar.js')); };
      document.head.appendChild(s);
    });
    return mkP;
  }
  function loadIR() { return IR ? Promise.resolve(IR) : (irP = irP || getJSON('data/irab.json').then(function (d) { IR = d; return d; })); }
  var BGC = {}, AS = null, asP = null;
  function loadBG(s) { var c = IDX.G[s - 1]; return BGC[c] ? Promise.resolve(BGC[c]) : getJSON('data/bg/' + c + '.json').then(function (d) { BGC[c] = d; return d; }); }
  function loadAS() { return AS ? Promise.resolve(AS) : (asP = asP || getJSON('data/asbab.json').then(function (d) { AS = d; return d; })); }
  function asbPane(el) {
    el.innerHTML = '<p class="loading">جارٍ تحميل أسباب النزول…</p>';
    var s = V.s, a = V.a;
    loadAS().then(function (d) {
      if (!V || V.s !== s || V.a !== a || el.dataset.t !== 'asb') return;
      var items = (d[String(s)] || []).filter(function (x) { return x[0] === a; });
      var head = '<div class="muted small">لباب النقول في أسباب النزول، للسيوطي</div>';
      if (!items.length) { el.innerHTML = head + '<p class="muted">لم يذكر السيوطي في «لباب النقول» سبب نزول لهذه الآية.</p>'; return; }
      el.innerHTML = head + items.map(function (x) { return '<div class="txt">' + linkRefs(esc(x[1])).replace(/\{([^}]+)\}/g, '<span class="q">﴿$1﴾</span>') + '</div>'; }).join('<hr class="sep">') +
        '<p class="muted small note">يذكر السيوطي الروايات بأسانيدها ويحكم على بعضها؛ ودرجة كل رواية تحتاج إلى مراجعة متخصص. والرمز (ك) عنده لما زاده على أسباب النزول للواحدي.</p>';
    }).catch(function (e) { console.warn(e); el.innerHTML = '<p class="muted">تعذّر تحميل أسباب النزول.</p>'; });
  }
  function loadUB(s) { var c = IDX.U[s - 1]; return UB[c] ? Promise.resolve(UB[c]) : getJSON('data/ub/' + c + '.json').then(function (d) { UB[c] = d; return d; }); }
  function part(kind, s) { return cache[kind][s] ? Promise.resolve(cache[kind][s]) : getJSON('data/' + kind + '/' + s + '.json').then(function (d) { cache[kind][s] = d; return d; }); }

  // surah-name lookup for references such as "[الإسراء/ 64]" and queries such as "الإسراء 64"
  var SN = {}, KEYN = {};
  function buildMaps() {
    IDX.S.forEach(function (x, i) { var n = nz(x[0]); SN[n] = i + 1; SN[n.replace(/^ال/, '')] = i + 1; });
    SN[nz('بني إسرائيل')] = 17; SN[nz('المؤمن')] = 40; SN[nz('حم السجدة')] = 41; SN[nz('فصلت')] = 41; SN[nz('الدهر')] = 76; SN[nz('براءة')] = 9;
    Object.keys(IDX.R).forEach(function (k) { if (k[0] !== '#') KEYN[nz(k)] = k; });
  }
  function sname(s) { return IDX.S[s - 1][0]; }
  function refLink(s, a, b) { return '<a class="ref" href="#' + s + ':' + a + '">' + esc(sname(s)) + ' ' + an(a) + (b ? '–' + an(b) : '') + '</a>'; }

  // al-Raghib entries for a word key (root, or #lemma)
  function entriesFor(key) {
    if (!key) return [];
    if (IDX.X[key]) return IDX.X[key];
    if (key[0] === '#') { var l = nz(key.slice(1)); return RG.N[l] || []; }
    return RG.R[key] || [];
  }
  function rgText(i, raw) { return linkRefs(esc(raw === undefined ? RG.T[i] : raw)); }
  function linkRefs(t) {
    return t.replace(/\[([^\]\/:\n]{2,24})[\/:]\s?(\d+)(?:\s?-\s?(\d+))?\]/g, function (m, name, a, b) {
      var s = SN[nz(name)] || SN[nz(name).replace(/^ال/, '')];
      if (!s || +a > IDX.S[s - 1][2]) return m;
      return '[' + refLink(s, +a, b ? +b : 0) + ']';
    });
  }
  function mkHTML(i, short) {
    var T = MK.T[i], body;
    if (short && T.length > 700) {
      var cut = T.indexOf('. ', 450); if (cut < 0 || cut > 800) cut = 500;
      body = linkRefs(esc(T.slice(0, cut + 1))) + '<details><summary class="small">بقية المدخل</summary>' + linkRefs(esc(T.slice(cut + 1))) + '</details>';
    } else body = linkRefs(esc(T));
    body = body.replace(/\{([^}]+)\}/g, '<span class="q">﴿$1﴾</span>');
    return '<div class="entry"><div class="head mk">' + esc(MK.H[i].replace(/ /g, '')) + ' <span class="pg">(ص ' + an(MK.P[i]) + ')</span></div><div class="txt">' + body + '</div></div>';
  }
  function mkFor(key) { return MK && key && key[0] !== '#' ? (MK.R[key] || []) : []; }
  function mkSection(key, short) {
    var M = mkFor(key); if (!M.length) return '';
    return '<div class="src2"><h3>مختار الصحاح</h3>' + M.map(function (i) { return mkHTML(i, short); }).join('') + '</div>';
  }
  function entryHTML(i, short) {
    var T = RG.T[i], body;
    if (short && T.length > 900) {
      var cut = T.lastIndexOf('\n', 650); if (cut < 300) cut = T.indexOf('، ', 600); if (cut < 0) cut = 650;
      body = rgText(i, T.slice(0, cut)) + '<details><summary class="small">بقية المدخل</summary>' + rgText(i, T.slice(cut)) + '</details>';
    } else body = rgText(i);
    return '<div class="entry"><div class="head">' + esc(RG.H[i]) + ' <span class="pg">(ص ' + an(RG.P[i]) + ')</span> <a class="small" href="#e/' + i + '">رابط المدخل</a></div><div class="txt">' + body + '</div></div>';
  }
  function refsHTML(key, limit) {
    var packed = IDX.R[key]; if (!packed) return '';
    var groups = packed.split(';'), n = 0, html = '', shown = 0;
    groups.forEach(function (g) { n += g.split(':')[1].split('.').length; });
    groups.forEach(function (g) {
      if (limit && shown >= limit) return;
      var p = g.split(':'), s = +p[0], ays = p[1].split('.');
      html += '<div class="s"><strong>' + esc(sname(s)) + ':</strong> ' + ays.map(function (a) { return '<a href="#' + s + ':' + a + '">' + an(a) + '</a>'; }).join('، ') + '</div>';
      shown++;
    });
    var more = limit && groups.length > limit ? '<p><a href="#r/' + encodeURIComponent(key) + '">كل المواضع في ' + suwar(groups.length) + '</a></p>' : '';
    return '<p class="muted">يرد في ' + ayat(n) + '.</p><div class="refs">' + html + '</div>' + more;
  }
  function keyLabel(key) { return key[0] === '#' ? 'الكلمة: ' + key.slice(1) : 'الجذر: ' + key; }

  // ---------------- views ----------------
  function home() {
    document.title = 'مفردات القرآن الكريم';
    if (window.innerWidth >= 700) setTimeout(function () { try { document.getElementById('q').focus(); } catch (e) {} }, 50);
    loadIdx().then(function () {
      app.innerHTML = '<section class="card"><h1>مفردات القرآن الكريم</h1>' +
        '<p>معاني ألفاظ القرآن الكريم من «المفردات في غريب القرآن» للراغب الأصفهاني (ت 502هـ)، ومن «مختار الصحاح» للرازي، مع وصف إعرابي مختصر لكل كلمة، ولكل آية «الميسر في غريب القرآن» وتفسيرا الجلالين والبيضاوي وتفسير البغوي، و«لباب النقول في أسباب النزول» للسيوطي، و«التبيان في إعراب القرآن» للعكبري.</p>' +
        '<ul class="plain"><li>ابدأ الكتابة في مربع البحث فتظهر الاقتراحات مع كل حرف: كلمة كما في المصحف (يستفزونك)، أو جذرها (فزز)، أو سورة، أو موضعاً (17:64 أو الإسراء 64).</li><li>في صفحة الآية تحت الآية مباشرة أزرار: غريب الآية، ومعنى الكلمة (الراغب ومختار الصحاح والوصف الإعرابي)، والجلالين، والبيضاوي، والبغوي، وأسباب النزول، وإعراب العكبري. وانقر أي كلمة لمعناها ومواضع جذرها.</li></ul></section>' +
        '<section class="card"><h2>السور</h2><div class="grid">' + IDX.S.map(function (x, i) { return '<a href="#' + (i + 1) + ':1">' + an(i + 1) + '. ' + esc(x[0]) + ' <span>' + an(x[2]) + '</span></a>'; }).join('') + '</div></section>';
    }).catch(fail);
  }

  var V = null;   // current verse state
  var TABS = [['gh', 'غريب الآية'], ['word', 'معنى الكلمة'], ['jal', 'الجلالين'], ['bay', 'البيضاوي'], ['bg', 'البغوي'], ['asb', 'أسباب النزول'], ['ub', 'إعراب العكبري']];
  function verse(s, a, opt) {
    opt = opt || {};
    loadIdx().then(function () {
      var n = IDX.S[s - 1][2]; a = Math.max(1, Math.min(n, a));
      document.title = sname(s) + ' ' + a + ' | مفردات القرآن الكريم';
      app.innerHTML = '<p class="loading">جارٍ التحميل…</p>';
      return Promise.all([part('q', s), part('jal', s).catch(miss), part('gh', s).catch(miss), loadRG()]).then(function (r) {
        var words = r[0][a - 1];
        var opts = IDX.S.map(function (x, i) { return '<option value="' + (i + 1) + '"' + (i + 1 === s ? ' selected' : '') + '>' + an(i + 1) + '. ' + esc(x[0]) + '</option>'; }).join('');
        var prev = a > 1 ? '#' + s + ':' + (a - 1) : (s > 1 ? '#' + (s - 1) + ':' + IDX.S[s - 2][2] : '');
        var next = a < n ? '#' + s + ':' + (a + 1) : (s < 114 ? '#' + (s + 1) + ':1' : '');
        var gh = r[2] ? r[2][String(a)] : null;
        var first = words.findIndex(function (w) { return entriesKnown(w[1]); });
        if (opt.wi != null && words[opt.wi]) first = opt.wi;
        else if (opt.key) { var kw = words.findIndex(function (w) { return w[1] === opt.key; }); if (kw >= 0) first = kw; }
        V = { s: s, a: a, words: words, jal: r[1], ghOK: !!r[2], gh: gh, wi: first };
        var saved = store('vtab'), tab = opt.tab || (TABS.some(function (t) { return t[0] === saved; }) ? saved : 'gh');
        if (tab === 'gh' && !gh) tab = 'word';
        if (opt.occ) document.title = '«' + opt.occ.q + '» | مفردات القرآن الكريم';
        app.innerHTML = (opt.occ ? occHTML(opt.occ) : '') +
          '<section class="card"><div class="nav' + (opt.occ ? ' hidenav' : '') + '"><select id="ssel" aria-label="السورة">' + opts + '</select> <label>الآية <input id="asel" type="number" min="1" max="' + n + '" value="' + a + '"></label>' +
          (prev ? '<a class="btn ghost" href="' + prev + '">‹ السابقة</a>' : '') + (next ? '<a class="btn ghost" href="' + next + '">التالية ›</a>' : '') + '</div>' +
          '<div class="verse">' + words.map(function (w, i) { return '<button class="w' + (entriesKnown(w[1]) ? '' : ' nokey') + '" data-i="' + i + '">' + esc(w[0]) + '</button>'; }).join(' ') + ' <span class="aya-no">﴿' + an(a) + '﴾</span></div>' +
          '<p class="muted small">' + esc(sname(s)) + '، الآية ' + an(a) + ' من ' + an(n) + (opt.occ ? ' — <a href="#' + s + ':' + a + '">فتح الآية وما حولها</a>' : '') + '. انقر كلمة لمعناها، أو اختر من الأزرار.</p>' +
          '<div class="tabs vt" role="tablist">' + TABS.map(function (t) { return '<button role="tab" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
          '<div id="pane" role="tabpanel"></div></section>';
        document.getElementById('ssel').onchange = function () { location.hash = '#' + this.value + ':1'; };
        document.getElementById('asel').onchange = function () { location.hash = '#' + s + ':' + this.value; };
        app.querySelectorAll('.w').forEach(function (b) { b.onclick = function () { V.wi = +b.dataset.i; markWord(); pane('word'); }; });
        app.querySelectorAll('.vt button').forEach(function (b) { b.onclick = function () { store('vtab', b.dataset.t); pane(b.dataset.t); }; });
        if (opt.occ) bindOcc(opt.occ);
        markWord(); pane(tab);
      });
    }).catch(fail);
  }
  // occurrences navigator shown above the verse when the page comes from a search
  function occHTML(o) {
    var L = o.list, n = L.length, i = o.i, groups = [], last = null;
    L.forEach(function (x, j) { if (!last || last.s !== x.s) { last = { s: x.s, items: [] }; groups.push(last); } last.items.push('<a href="#" data-j="' + j + '"' + (j === i ? ' class="on"' : '') + '>' + an(x.a) + '</a>'); });
    var others = (o.others || []).map(function (k) { return '<a href="#w/' + encodeURIComponent(k[0] === '#' ? k.slice(1) : k) + '">' + esc(keyLabel(k)) + '</a>'; }).join('، ');
    return '<section class="card occ"><div class="occ-head"><strong class="q">«' + esc(o.q) + '»</strong> <span class="muted small">' + esc(o.how) + '، ' + ayat(n) + '</span></div>' +
      '<div class="nav"><button class="btn ghost" id="oprev"' + (i ? '' : ' disabled') + '>‹ السابق</button><span class="small">الموضع ' + an(i + 1) + ' من ' + an(n) + ': ' + esc(sname(L[i].s)) + ' ' + an(L[i].a) + '</span><button class="btn ghost" id="onext"' + (i < n - 1 ? '' : ' disabled') + '>التالي ›</button></div>' +
      '<details class="allocc"><summary class="small">كل المواضع</summary><div class="refs">' + groups.map(function (g) { return '<div class="s"><strong>' + esc(sname(g.s)) + ':</strong> ' + g.items.join('، ') + '</div>'; }).join('') + '</div></details>' +
      (others ? '<p class="small muted">نتائج أخرى: ' + others + '</p>' : '') + '</section>';
  }
  function bindOcc(o) {
    function goTo(j) { var x = o.list[j]; o.i = j; verse(x.s, x.a, { wi: x.w, key: o.key, tab: 'word', occ: o }); window.scrollTo(0, 0); }
    var p = document.getElementById('oprev'), nx = document.getElementById('onext');
    if (p) p.onclick = function () { if (o.i > 0) goTo(o.i - 1); };
    if (nx) nx.onclick = function () { if (o.i < o.list.length - 1) goTo(o.i + 1); };
    app.querySelectorAll('.allocc a[data-j]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); goTo(+a.dataset.j); }; });
  }
  var FR = null, frP = null;
  function loadFR() { return FR ? Promise.resolve(FR) : (frP = frP || getJSON('data/forms.json').then(function (d) { FR = d; return d; })); }
  function refsOfKey(key) {
    var out = []; (IDX.R[key] || '').split(';').forEach(function (g) { if (!g) return; var p = g.split(':'); p[1].split('.').forEach(function (a) { out.push({ s: +p[0], a: +a, w: null }); }); });
    return out;
  }
  function refsOfForm(f) { return (FR[f] || '').split(',').filter(Boolean).map(function (r) { var m = r.match(/^(\d+):(\d+)\.(\d+)$/); return { s: +m[1], a: +m[2], w: +m[3] }; }); }
  function openOcc(q, how, key, list, others) {
    if (!list.length) return false;
    var o = { q: q, how: how, key: key, list: list, i: 0, others: others };
    verse(list[0].s, list[0].a, { wi: list[0].w, key: key, tab: 'word', occ: o });
    return true;
  }
  function entriesKnown(key) { return key && entriesFor(key).length > 0; }
  function markWord() { app.querySelectorAll('.w').forEach(function (b) { b.classList.toggle('on', +b.dataset.i === V.wi); }); }
  function pane(t) {
    app.querySelectorAll('.vt button').forEach(function (x) { x.setAttribute('aria-selected', x.dataset.t === t); });
    var el = document.getElementById('pane'); el.className = t === 'bay' || t === 'bg' || t === 'ub' || t === 'asb' ? 'scroll' : ''; el.dataset.t = t; el.scrollTop = 0;
    if (t === 'gh') return ghPane(el);
    if (t === 'asb') return asbPane(el);
    if (t === 'ub') return ubPane(el);
    if (t === 'word') return wordPane(el);
    return tafsir(V.s, V.a, t, V.jal, el);
  }
  function ghPane(el) {
    if (!V.ghOK) { el.innerHTML = '<p class="muted">تعذّر تحميل ملف الغريب لهذه السورة.</p>'; return; }
    if (!V.gh) { el.innerHTML = '<p class="muted">لا شيء لهذه الآية في «الميسر في غريب القرآن». جرّب «معنى الكلمة» أو التفسير.</p>'; return; }
    var k = V.wi >= 0 ? nz(V.words[V.wi][0]).replace(/ /g, '') : '';
    el.innerHTML = '<div class="muted small">من «الميسر في غريب القرآن»</div><div class="gh">' + V.gh.split(/\n+/).filter(Boolean).map(function (l) {
      var d = nz((l.match(/﴿([^﴾]+)﴾/) || [])[1] || '').replace(/ /g, '');
      return '<p' + (k && d === k ? ' class="hit"' : '') + '>' + esc(l).replace(/﴿([^﴾]+)﴾/g, '<span class="q">﴿$1﴾</span>') + '</p>';
    }).join('') + '</div>';
  }
  function wordPane(el) {
    if (V.wi < 0) { el.innerHTML = '<p class="muted">انقر كلمة من الآية.</p>'; return; }
    var w = V.words[V.wi], key = w[1], E = entriesFor(key), wi = V.wi, s = V.s, a = V.a;
    var html = '<h2>' + esc(w[0]) + '</h2><p class="irab" id="irab"><span class="muted small">الوصف الإعرابي…</span></p>';
    if (!key) html += '<p class="muted">لا جذر لهذه الكلمة في مدونة ليدز (حرف أو أداة).</p>';
    else {
      html += '<p class="muted">' + esc(keyLabel(key)) + ' — <a href="#r/' + encodeURIComponent(key) + '">التنقل في مواضعه</a> · <a href="#r/' + encodeURIComponent(key) + '/full">صفحة الجذر كاملة</a></p>';
      html += '<h3>المفردات للراغب</h3>' + (E.length ? E.map(function (i) { return entryHTML(i, true); }).join('') : '<p class="muted">لا مدخل لهذا ' + (key[0] === '#' ? 'اللفظ' : 'الجذر') + ' في «المفردات».</p>');
      html += '<div id="mk"></div>';
    }
    el.innerHTML = html;
    loadIR().then(function (d) {
      var x = document.getElementById('irab'); if (!x || !V || V.wi !== wi || V.s !== s || V.a !== a) return;
      var idx = d.V[s - 1][a - 1][wi];
      x.innerHTML = '<strong>الوصف الإعرابي:</strong> ' + esc(d.D[idx]).replace(/ \+ /g, ' <span class="plus">+</span> ') + ' <span class="muted small">(آلي من مدونة ليدز)</span>';
    }).catch(function (e) { console.warn(e); var x = document.getElementById('irab'); if (x) x.innerHTML = ''; });
    if (key && key[0] !== '#') loadMK().then(function () {
      var x = document.getElementById('mk'); if (!x || !V || V.wi !== wi || V.s !== s || V.a !== a) return;
      x.innerHTML = mkSection(key, true) || '<div class="src2"><h3>مختار الصحاح</h3><p class="muted">لا مدخل لهذا الجذر في «مختار الصحاح».</p></div>';
    }).catch(function (e) { console.warn(e); });
  }
  function ubPane(el) {
    el.innerHTML = '<p class="loading">جارٍ تحميل إعراب العكبري…</p>';
    var s = V.s, a = V.a;
    loadUB(s).then(function (d) {
      if (!V || V.s !== s || V.a !== a || el.dataset.t !== 'ub') return;
      var secs = (d[String(s)] || []).filter(function (x) { return x[0] <= a && a <= x[1]; });
      var head = '<div class="muted small">التبيان في إعراب القرآن، لأبي البقاء العكبري</div>';
      if (!secs.length) { el.innerHTML = head + '<p class="muted">لم يقف العكبري عند هذه الآية.</p>'; return; }
      el.innerHTML = head + secs.map(function (x) {
        var note = x[0] !== x[1] ? '<p class="muted small">هذا الموضع يشمل الآيات ' + an(x[0]) + '–' + an(x[1]) + '.</p>' : '';
        return note + '<div class="txt ub">' + linkRefs(esc(x[2])).replace(/\(([^()]{1,80})\)/g, '<span class="q">($1)</span>') + '</div>';
      }).join('<hr class="sep">');
    }).catch(function (e) { console.warn(e); el.innerHTML = '<p class="muted">تعذّر تحميل إعراب العكبري لهذه السورة.</p>'; });
  }
  function tafsir(s, a, t, jal, el) {
    if (t === 'jal' && !jal) { el.innerHTML = '<p class="muted">تعذّر تحميل تفسير الجلالين لهذه السورة.</p>'; return; }
    if (t === 'jal') { el.innerHTML = '<div class="muted small">تفسير الجلالين (المحلي والسيوطي)</div><div class="txt">' + esc(jal[a - 1]).replace(/«([^»]+)»/g, '<span class="q">«$1»</span>') + '</div>'; return; }
    var bay = t === 'bay', name = bay ? 'تفسير البيضاوي' : 'تفسير البغوي', title = bay ? 'أنوار التنزيل وأسرار التأويل، للبيضاوي' : 'معالم التنزيل، للبغوي';
    el.innerHTML = '<p class="loading">جارٍ تحميل ' + name + '…</p>';
    var src = bay ? part('bay', s) : loadBG(s).then(function (d) { return d[String(s)] || []; });
    Promise.all([src, part('q', s)]).then(function (r) {
      if (!V || V.s !== s || V.a !== a || el.dataset.t !== t) return;
      var P = r[0].filter(function (x) { return x[0] <= a && a <= x[1]; });
      if (!P.length) { el.innerHTML = '<div class="muted small">' + title + '</div><p class="muted">لا شيء لهذه الآية.</p>'; return; }
      var vs = sk(r[1][a - 1].map(function (w) { return w[0]; }).join(''));
      el.innerHTML = '<div class="muted small">' + title + '</div>' + P.map(function (x) {
        var from = x[0], to = x[1];
        var note = from !== to ? '<p class="muted small">هذا الموضع من ' + name + ' يشمل الآيات ' + an(from) + '–' + an(to) + '، والمظلَّل ما يخص الآية ' + an(a) + '.</p>' : '';
        var body = esc(x[2]).replace(/\{([^}]+)\}/g, function (m, qt) {
          var k2 = sk(qt), on = from !== to && k2.length >= 4 && vs.indexOf(k2) >= 0;
          return '<span class="q' + (on ? ' cur' : '') + '">﴿' + qt.trim() + '﴾</span>';
        });
        return note + '<div class="txt">' + body + '</div>';
      }).join('<hr class="sep">');
      var c = el.querySelector('.cur'); el.scrollTop = c ? Math.max(0, c.offsetTop - 40) : 0;
    }).catch(function (e) { console.warn(e); el.innerHTML = '<p class="muted">تعذّر تحميل ' + name + ' لهذه السورة.</p>'; });
  }

  function rootView(key) {
    if (location.hash.indexOf('#r/') === 0 && !/\/full$/.test(decodeURIComponent(location.hash))) {
      return loadIdx().then(function () { if (!openOcc(key[0] === '#' ? key.slice(1) : key, keyLabel(key), key, refsOfKey(key), [])) rootFull(key); }).catch(fail);
    }
    rootFull(key.replace(/\/full$/, ''));
  }
  function rootFull(key) {
    Promise.all([loadIdx(), loadRG(), loadMK().catch(miss)]).then(function () {
      document.title = keyLabel(key) + ' | مفردات القرآن الكريم';
      var E = entriesFor(key);
      app.innerHTML = '<section class="card"><h1>' + esc(keyLabel(key)) + '</h1><h3>المفردات للراغب</h3>' + (E.length ? E.map(function (i) { return entryHTML(i); }).join('') : '<p class="muted">لا مدخل له في «المفردات».</p>') + mkSection(key, false) + '</section>' +
        '<section class="card"><h2>المواضع</h2>' + (refsHTML(key, 0) || '<p class="muted">لا مواضع.</p>') + '</section>';
    }).catch(fail);
  }
  function entryView(i) {
    Promise.all([loadIdx(), loadRG()]).then(function () {
      if (!RG.H[i]) return home();
      document.title = RG.H[i] + ' | مفردات القرآن الكريم';
      var keys = Object.keys(RG.R).filter(function (k) { return RG.R[k].indexOf(i) >= 0; });
      Object.keys(IDX.X).forEach(function (k) { if (IDX.X[k].indexOf(i) >= 0) keys.push(k); });
      Object.keys(RG.N).forEach(function (n) { if (RG.N[n].indexOf(i) >= 0) Object.keys(IDX.R).forEach(function (k) { if (k[0] === '#' && nz(k.slice(1)) === n && keys.indexOf(k) < 0) keys.push(k); }); });
      app.innerHTML = '<section class="card">' + entryHTML(i) + '</section>' +
        keys.filter(function (k) { return IDX.R[k]; }).map(function (k) { return '<section class="card"><h2>مواضع ' + esc(keyLabel(k)) + '</h2>' + refsHTML(k, 12) + '</section>'; }).join('');
    }).catch(fail);
  }

  var PREF = ['وال', 'فال', 'بال', 'كال', 'لل', 'ال', 'و', 'ف', 'ب', 'ل', 'ك', 'س'];
  function search(raw) {
    Promise.all([loadIdx(), loadRG(), loadMK().catch(miss), loadFR().catch(miss)]).then(function () {
      var q = raw.trim(); if (!q) return home();
      var m = q.match(/^(\d{1,3})\s*[:：\/ ]\s*(\d{1,3})$/);
      if (m) { location.hash = '#' + m[1] + ':' + m[2]; return; }
      m = q.match(/^(.+?)\s+(\d{1,3})$/);
      if (m && (SN[nz(m[1])] || SN[nz(m[1]).replace(/^ال/, '')])) { location.hash = '#' + (SN[nz(m[1])] || SN[nz(m[1]).replace(/^ال/, '')]) + ':' + m[2]; return; }
      var n = nz(q).replace(/\s+/g, ' '), keys = [], how = '', form = '';
      if (IDX.F[n]) { keys = IDX.F[n].slice(); how = 'الكلمة بنصها في المصحف'; form = n; }
      if (!keys.length) for (var p = 0; p < PREF.length && !keys.length; p++) if (n.indexOf(PREF[p]) === 0 && n.length - PREF[p].length >= 2 && IDX.F[n.slice(PREF[p].length)]) { form = n.slice(PREF[p].length); keys = IDX.F[form].slice(); how = 'بعد حذف السابقة «' + PREF[p] + '»'; }
      var merged = null;
      if (!keys.length) {
        var vf = PREF.concat(['ل', 'ب']).map(function (x) { return x + n; }).filter(function (f, i, A) { return IDX.F[f] && A.indexOf(f) === i; });
        if (vf.length) {
          keys = IDX.F[vf[0]].slice(); vf.forEach(function (f) { IDX.F[f].forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); }); });
          how = 'الكلمة في المصحف بالسوابق: ' + vf.join('، ');
          if (FR) { merged = []; vf.forEach(function (f) { merged = merged.concat(refsOfForm(f)); }); merged.sort(function (x, y) { return x.s - y.s || x.a - y.a || x.w - y.w; }); }
        }
      }
      if (!keys.length && n.length >= 3 && !KEYN[n]) {
        var cnt = {};
        Object.keys(IDX.F).forEach(function (f) { if (f.indexOf(n) >= 0) IDX.F[f].forEach(function (k) { cnt[k] = (cnt[k] || 0) + 1; }); });
        keys = Object.keys(cnt).sort(function (x, y) { return cnt[y] - cnt[x]; });
        if (keys.length) how = 'كلمات في المصحف تحتوي «' + q + '»';
      }
      if (KEYN[n] && keys.indexOf(KEYN[n]) < 0) { keys.unshift(KEYN[n]); how = how || 'جذر'; }
      if (merged && merged.length && openOcc(q, how, keys[0], merged, keys.slice(1))) return;
      if (form && FR && FR[form]) { var fl = refsOfForm(form); if (openOcc(q, how, keys[0], fl, keys.slice(1))) return; }
      if (keys.length) { if (openOcc(q, how === 'جذر' ? 'جذر «' + keys[0] + '»' : how + '، مواضع الجذر «' + keys[0].replace(/^#/, '') + '»', keys[0], refsOfKey(keys[0]), keys.slice(1))) return; }
      var heads = (RG.HN[n] || []).filter(function (i) { return !keys.some(function (k) { return entriesFor(k).indexOf(i) >= 0; }); });
      var full = [];
      if (!keys.length && !heads.length && n.length >= 3) RG.T.forEach(function (t, i) { if (full.length < 40 && nz(t).indexOf(n) >= 0) full.push(i); });
      document.title = q + ' | مفردات القرآن الكريم';
      var html = '<section class="card"><h1>«' + esc(q) + '»</h1>' + (how ? '<p class="muted">وُجدت: ' + esc(how) + '.</p>' : '') + '</section>';
      keys.slice(0, 4).forEach(function (k) {
        var E = entriesFor(k);
        html += '<section class="card"><h2>' + esc(keyLabel(k)) + '</h2><h3>المفردات للراغب</h3>' + (E.length ? E.map(function (i) { return entryHTML(i, true); }).join('') : '<p class="muted">لا مدخل له في «المفردات».</p>') + mkSection(k, true) + '<h3>المواضع</h3>' + refsHTML(k, 10) + '</section>';
      });
      heads.forEach(function (i) { html += '<section class="card">' + entryHTML(i) + '</section>'; });
      if (full.length) html += '<section class="card"><h2>مداخل يرد فيها اللفظ</h2><p>' + full.map(function (i) { return '<a href="#e/' + i + '">' + esc(RG.H[i]) + '</a>'; }).join('، ') + '</p></section>';
      if (!keys.length && !heads.length && !full.length) html += '<section class="card"><p>لم يُعثر على نتيجة. جرّب الكلمة كما في المصحف، أو جذرها الثلاثي، أو موضعاً مثل 17:64.</p></section>';
      app.innerHTML = html;
    }).catch(fail);
  }

  function about() {
    document.title = 'المصادر وحدود الموقع | مفردات القرآن الكريم';
    app.innerHTML = '<section class="card"><h1>المصادر وحدود الموقع</h1><ul class="plain">' +
      '<li><strong>«المفردات في غريب القرآن»</strong> للراغب الأصفهاني (ت 502هـ)، تحقيق صفوان عدنان داودي (دار القلم والدار الشامية). النص من مدونة OpenITI عن المكتبة الشاملة بترخيص CC BY-NC-SA 4.0، وأرقام الصفحات من هذه الطبعة. رُبطت المداخل بجذور الكلمات آلياً، فقد يغيب مدخل عن كلمة أو يُربط بها مدخل قريب.</li>' +
      '<li><strong>تفسير البيضاوي</strong> («أنوار التنزيل وأسرار التأويل»، ت 685هـ): من مدونة OpenITI بترخيص CC BY-NC-SA 4.0، وهي نسخة موقع altafsir.com المقسّمة على الآيات، بلا تشكيل ولا ترقيم صفحات ولا مقدمة المؤلف. قد يشمل الموضع الواحد عدة آيات، فتُظلَّل العبارات القرآنية التي تخص الآية المعروضة.</li>' +
      '<li><strong>تفسير البغوي</strong> («معالم التنزيل»، ت 516هـ): من مدونة OpenITI بترخيص CC BY-NC-SA 4.0، وهي نسخة موقع altafsir.com المقسّمة على الآيات، بلا تشكيل ولا ترقيم صفحات.</li>' +
      '<li><strong>«لباب النقول في أسباب النزول»</strong> للسيوطي (ت 911هـ): من مدونة OpenITI بترخيص CC BY-NC-SA 4.0 (نسخة ShamAY0034090). قُسّم على الآيات آلياً بمطابقة الألفاظ القرآنية التي يبدأ بها كل خبر، وتطابق ذلك في نحو 98% من الأخبار، فقد يقع خبر قليل في غير آيته. والكتاب يذكر الروايات بأسانيدها، ودرجتها تحتاج إلى مراجعة متخصص.</li>' +
      '<li><strong>«الميسر في غريب القرآن»</strong>: النص الرقمي من مجموعة QUL (Tarteel)، ولا تذكر المجموعة معلومات حقوقه، فيحتاج ترخيص نشره إلى تحقق من الناشر. حُوّلت علامات الرسم العثماني في الكلمات المشروحة إلى علامات الإملاء المعتاد ليُحسن عرضها.</li>' +
      '<li><strong>«مختار الصحاح»</strong> لزين الدين محمد بن أبي بكر الرازي (ت 666هـ)، تحقيق يوسف الشيخ محمد (المكتبة العصرية، ط5 1420هـ/1999م): من مدونة OpenITI بترخيص CC BY-NC-SA 4.0، وأرقام الصفحات من هذه الطبعة. رُبطت مداخله بالجذور آلياً، والمختار يتبع الجوهري في ردّ بعض الألفاظ إلى غير جذرها في مدونة ليدز، فقد يغيب المدخل عن كلمة.</li>' +
      '<li><strong>«التبيان في إعراب القرآن»</strong> لأبي البقاء العكبري (ت 616هـ)، تحقيق علي محمد البجاوي (عيسى البابي الحلبي): من مدونة OpenITI بترخيص CC BY-NC-SA 4.0. قُسّم النص على الآيات آلياً بأرقام الآيات التي يذكرها المحقق في رؤوس الفقرات ومطابقتها لنص الآية، وتحقق ذلك نصياً في نحو 97% من المواضع، فقد يقع موضع قليل في غير آيته.</li>' +
      '<li><strong>الوصف الإعرابي للكلمة</strong>: يُولَّد آلياً من وسوم مدونة القرآن العربية (جامعة ليدز)، ويذكر نوع كل جزء من الكلمة وحالته (الرفع والنصب والجر والجزم، والبناء للمجهول)، ولا يذكر الوظيفة النحوية (فاعل، مفعول، حال…). وفي وسوم المدونة أخطاء معروفة قليلة تنتقل إلى الوصف، فهو عون على الفهم لا بديل عن كتب الإعراب.</li>' +
      '<li><strong>تفسير الجلالين</strong> (جلال الدين المحلي وجلال الدين السيوطي) و<strong>نص القرآن الكريم</strong>: من Tanzil.net، ويُنشران دون تعديل مع ذكر المصدر.</li>' +
      '<li><strong>الجذور</strong>: من التحليل الصرفي لمدونة القرآن العربية (جامعة ليدز). ربط الكلمات بالجذور آلي، ويعرض الموقع ما لا جذر له (الحروف والأدوات وبعض الأعلام) دون مدخل إلا ما طابق عنواناً في «المفردات».</li>' +
      '<li>الموقع لا يرجّح بين ما في المصادر، ولا يغني عن الرجوع إلى الكتب المطبوعة، ونسبة النصوص إلى طبعاتها تحتاج إلى مراجعة متخصص.</li>' +
      '<li>الموقع غير تجاري، وهو شقيق <a href="https://izzatahmed.github.io/hypertext/">الموسوعة القرآنية المترابطة</a>.</li></ul></section>';
  }

  function fail(e) { console.error(e); app.innerHTML = '<section class="card"><p>تعذّر تحميل البيانات. إن كنت تفتح الملف من جهازك مباشرة فشغّله عبر خادم ويب أو من GitHub Pages.</p><p class="muted small">' + esc(e && e.message || e) + '</p></section>'; }

  function route() {
    var h = decodeURIComponent(location.hash.slice(1));
    var m = h.match(/^(\d{1,3}):(\d{1,3})$/);
    if (m && +m[1] >= 1 && +m[1] <= 114) return verse(+m[1], +m[2]);
    if (h.indexOf('r/') === 0) return rootView(h.slice(2));
    if (h.indexOf('e/') === 0) return entryView(+h.slice(2));
    if (h.indexOf('w/') === 0) { document.getElementById('q').value = h.slice(2); return search(h.slice(2)); }
    if (h === 'about') return about();
    return home();
  }
  // ---------------- live suggestions while typing ----------------
  var qi = document.getElementById('q'), sg = document.getElementById('sugg'), form = document.getElementById('sform');
  var tm = null, items = [], cur = -1, FK = null, KC = {};
  function keyCount(k) { if (KC[k] === undefined) { var p = IDX.R[k] || ''; KC[k] = p ? p.split(/[;.]/).length : 0; } return KC[k]; }
  function hideS() { sg.hidden = true; sg.innerHTML = ''; items = []; cur = -1; qi.setAttribute('aria-expanded', 'false'); }
  function go(href) { hideS(); if (window.innerWidth < 700) qi.blur(); if (location.hash === href) route(); else location.hash = href; }
  function suggest() {
    var q = qi.value.trim(); if (!q) return hideS();
    Promise.all([loadIdx(), loadRG()]).then(function () {
      if (qi.value.trim() !== q) return;
      var n = nz(q).replace(/\s+/g, ' '), out = [], m;
      if ((m = q.match(/^(\d{1,3})\s*[:：\/ ]\s*(\d{1,3})$/)) && +m[1] >= 1 && +m[1] <= 114) out.push({ h: '#' + m[1] + ':' + m[2], t: 'الآية ' + an(m[2]) + ' من ' + sname(+m[1]), l: 'موضع' });
      if ((m = q.match(/^(.+?)\s+(\d{1,3})$/))) { var sn = SN[nz(m[1])] || SN[nz(m[1]).replace(/^ال/, '')]; if (sn) out.push({ h: '#' + sn + ':' + m[2], t: sname(sn) + ' ' + an(m[2]), l: 'موضع' }); }
      if (!/\d/.test(n)) {
        IDX.S.forEach(function (x, i) { var sn = nz(x[0]); if (out.length < 3 && (sn.indexOf(n) === 0 || sn.replace(/^ال/, '').indexOf(n) === 0)) out.push({ h: '#' + (i + 1) + ':1', t: 'سورة ' + x[0], l: an(x[2]) + ' آية' }); });
        if (KEYN[n]) out.push({ h: '#r/' + encodeURIComponent(KEYN[n]), t: 'الجذر ' + KEYN[n], l: 'يرد في ' + ayat(keyCount(KEYN[n])) });
        if (n.length >= 2) {
          FK = FK || Object.keys(IDX.F);
          var pre = [], mid = [];
          FK.forEach(function (f) { var i = f.indexOf(n); if (i === 0) pre.push(f); else if (i > 0 && n.length >= 3) mid.push(f); });
          var rank = function (x, y) { return x.length - y.length || keyCount(IDX.F[y][0]) - keyCount(IDX.F[x][0]); };
          pre.sort(rank); mid.sort(rank);
          pre.concat(mid).slice(0, 8).forEach(function (f) { var k = IDX.F[f][0]; out.push({ h: '#w/' + encodeURIComponent(f), t: f, l: k[0] === '#' ? 'كلمة' : 'جذر ' + k }); });
        }
        var hn = 0;
        RG.H.forEach(function (h, i) { if (hn < 4 && nz(h).indexOf(n) === 0) { hn++; out.push({ h: '#e/' + i, t: h, l: 'مدخل في «المفردات»' }); } });
      }
      out.push({ h: '#w/' + encodeURIComponent(q), t: 'بحث كامل عن «' + q + '»', l: '↵', all: true });
      items = out; cur = -1;
      sg.innerHTML = out.map(function (x, i) { return '<li role="option" id="sg' + i + '"' + (x.all ? ' class="all"' : '') + '><a href="' + x.h + '" data-i="' + i + '"><span>' + esc(x.t) + '</span><small>' + esc(x.l) + '</small></a></li>'; }).join('');
      sg.hidden = false; qi.setAttribute('aria-expanded', 'true');
      sg.querySelectorAll('a').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); go(items[+a.dataset.i].h); }; });
    }).catch(function (e) { console.warn(e); });
  }
  function hl(i) {
    var li = sg.querySelectorAll('li'); if (!li.length) return;
    cur = (i + li.length) % li.length;
    li.forEach(function (x, j) { x.classList.toggle('on', j === cur); });
    qi.setAttribute('aria-activedescendant', 'sg' + cur); li[cur].scrollIntoView({ block: 'nearest' });
  }
  qi.addEventListener('focus', function () { loadIdx().catch(miss); loadRG().catch(miss); if (qi.value.trim()) suggest(); });
  qi.addEventListener('input', function () { clearTimeout(tm); tm = setTimeout(suggest, 120); });
  qi.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); hl(cur + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); hl(cur - 1); }
    else if (e.key === 'Escape') hideS();
  });
  document.addEventListener('click', function (e) { if (!form.contains(e.target)) hideS(); });
  form.onsubmit = function (e) {
    e.preventDefault(); clearTimeout(tm);
    if (cur >= 0 && items[cur]) return go(items[cur].h);
    var v = qi.value.trim(); if (v) go('#w/' + encodeURIComponent(v));
  };
  window.addEventListener('hashchange', function () { route(); window.scrollTo(0, 0); });
  route();
})();
