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
  function rgText(i, raw) {
    var t = esc(raw === undefined ? RG.T[i] : raw);
    t = t.replace(/\[([^\]\/\n]{2,24})\/\s?(\d+)(?:\s?-\s?(\d+))?\]/g, function (m, name, a, b) {
      var s = SN[nz(name)] || SN[nz(name).replace(/^ال/, '')];
      if (!s || +a > IDX.S[s - 1][2]) return m;
      return '[' + refLink(s, +a, b ? +b : 0) + ']';
    });
    return t;
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
    loadIdx().then(function () {
      app.innerHTML = '<section class="card"><h1>مفردات القرآن الكريم</h1>' +
        '<p>معاني ألفاظ القرآن الكريم من «المفردات في غريب القرآن» للراغب الأصفهاني (ت 502هـ)، ومعها لكل آية «الميسر في غريب القرآن» وتفسيران موجزان: الجلالين والبيضاوي.</p>' +
        '<ul class="plain"><li>اكتب كلمة كما في المصحف (يستفزونك)، أو جذرها (فزز)، أو موضعاً (17:64 أو الإسراء 64).</li><li>في صفحة الآية انقر أي كلمة لترى مدخلها عند الراغب ومواضع جذرها.</li></ul></section>' +
        '<section class="card"><h2>السور</h2><div class="grid">' + IDX.S.map(function (x, i) { return '<a href="#' + (i + 1) + ':1">' + an(i + 1) + '. ' + esc(x[0]) + ' <span>' + an(x[2]) + '</span></a>'; }).join('') + '</div></section>';
    }).catch(fail);
  }

  var selWord = null;
  function verse(s, a) {
    loadIdx().then(function () {
      var n = IDX.S[s - 1][2]; a = Math.max(1, Math.min(n, a));
      document.title = sname(s) + ' ' + a + ' | مفردات القرآن الكريم';
      app.innerHTML = '<p class="loading">جارٍ التحميل…</p>';
      return Promise.all([part('q', s), part('jal', s), part('gh', s), loadRG()]).then(function (r) {
        var words = r[0][a - 1];
        var opts = IDX.S.map(function (x, i) { return '<option value="' + (i + 1) + '"' + (i + 1 === s ? ' selected' : '') + '>' + an(i + 1) + '. ' + esc(x[0]) + '</option>'; }).join('');
        var prev = a > 1 ? '#' + s + ':' + (a - 1) : (s > 1 ? '#' + (s - 1) + ':' + IDX.S[s - 2][2] : '');
        var next = a < n ? '#' + s + ':' + (a + 1) : (s < 114 ? '#' + (s + 1) + ':1' : '');
        var gh = r[2][String(a)];
        var ghHTML = gh ? gh.split(/\n+/).filter(Boolean).map(function (l) { return '<p data-k="' + esc(nz((l.match(/﴿([^﴾]+)﴾/) || [])[1] || '')) + '">' + esc(l).replace(/﴿([^﴾]+)﴾/g, '<span class="q">﴿$1﴾</span>') + '</p>'; }).join('') : '<p class="muted">لا شيء لهذه الآية في «الميسر في غريب القرآن».</p>';
        var tab = store('tafsir') === 'bay' ? 'bay' : 'jal';
        app.innerHTML =
          '<section class="card"><div class="nav"><select id="ssel" aria-label="السورة">' + opts + '</select> <label>الآية <input id="asel" type="number" min="1" max="' + n + '" value="' + a + '"></label>' +
          (prev ? '<a class="btn ghost" href="' + prev + '">‹ السابقة</a>' : '') + (next ? '<a class="btn ghost" href="' + next + '">التالية ›</a>' : '') + '</div>' +
          '<div class="verse">' + words.map(function (w, i) { return '<button class="w' + (entriesKnown(w[1]) ? '' : ' nokey') + '" data-i="' + i + '">' + esc(w[0]) + '</button>'; }).join(' ') + ' <span class="aya-no">﴿' + an(a) + '﴾</span></div>' +
          '<p class="muted small">' + esc(sname(s)) + '، الآية ' + an(a) + ' من ' + an(n) + '. انقر كلمة لمعناها عند الراغب.</p></section>' +
          '<section class="card"><h2>غريب الآية</h2><div class="muted small">من «الميسر في غريب القرآن»</div><div class="gh" id="gh">' + ghHTML + '</div></section>' +
          '<section class="card" id="wpanel"><p class="muted">انقر كلمة من الآية.</p></section>' +
          '<section class="card"><h2>التفسير</h2><div class="tabs" role="tablist"><button role="tab" data-t="jal" aria-selected="' + (tab === 'jal') + '">الجلالين</button><button role="tab" data-t="bay" aria-selected="' + (tab === 'bay') + '">البيضاوي</button></div><div id="tf" class="txt"></div></section>';
        document.getElementById('ssel').onchange = function () { location.hash = '#' + this.value + ':1'; };
        document.getElementById('asel').onchange = function () { location.hash = '#' + s + ':' + this.value; };
        app.querySelectorAll('.w').forEach(function (b) { b.onclick = function () { showWord(words, +b.dataset.i); }; });
        app.querySelectorAll('.tabs button').forEach(function (b) { b.onclick = function () { store('tafsir', b.dataset.t); app.querySelectorAll('.tabs button').forEach(function (x) { x.setAttribute('aria-selected', x === b); }); tafsir(s, a, b.dataset.t, r[1]); }; });
        tafsir(s, a, tab, r[1]);
        var first = words.findIndex(function (w) { return entriesKnown(w[1]); });
        if (selWord !== null && words[selWord]) showWord(words, selWord); else if (first >= 0) showWord(words, first);
        selWord = null;
      });
    }).catch(fail);
  }
  function entriesKnown(key) { return key && entriesFor(key).length > 0; }
  function showWord(words, i) {
    app.querySelectorAll('.w').forEach(function (b) { b.classList.toggle('on', +b.dataset.i === i); });
    var w = words[i], key = w[1], E = entriesFor(key), p = document.getElementById('wpanel');
    var html = '<h2>' + esc(w[0]) + '</h2>';
    if (!key) html += '<p class="muted">لا جذر لهذه الكلمة في مدونة ليدز (حرف أو أداة).</p>';
    else {
      html += '<p class="muted">' + esc(keyLabel(key)) + ' — <a href="#r/' + encodeURIComponent(key) + '">مواضعه في القرآن الكريم</a></p>';
      html += E.length ? E.map(function (i) { return entryHTML(i, true); }).join('') : '<p class="muted">لا مدخل لهذا ' + (key[0] === '#' ? 'اللفظ' : 'الجذر') + ' في «المفردات».</p>';
    }
    p.innerHTML = html;
    var k = nz(w[0]).replace(/ /g, '');
    document.querySelectorAll('#gh p').forEach(function (x) { var d = (x.dataset.k || '').replace(/ /g, ''); x.classList.toggle('hit', !!d && (d === k || nz(d) === k)); });
  }
  function tafsir(s, a, t, jal) {
    var el = document.getElementById('tf');
    if (t === 'jal') { el.innerHTML = '<div class="muted small">تفسير الجلالين (المحلي والسيوطي)</div>' + esc(jal[a - 1]).replace(/«([^»]+)»/g, '<span class="q">«$1»</span>'); return; }
    el.innerHTML = '<p class="loading">جارٍ تحميل تفسير البيضاوي للسورة…</p>';
    Promise.all([part('bay', s), part('q', s)]).then(function (r) {
      var d = r[0], j = 0; for (var k = 0; k < d.length; k++) if (d[k][0] <= a && a <= d[k][1]) j = k;
      var from = d[j][0], to = d[j][1];
      var note = from !== to ? '<p class="muted small">هذا الموضع من تفسير البيضاوي يشمل الآيات ' + an(from) + '–' + an(to) + '، والمظلَّل ما يخص الآية ' + an(a) + '.</p>' : '';
      var vs = sk(r[1][a - 1].map(function (w) { return w[0]; }).join(''));
      var body = esc(d[j][2]).replace(/\{([^}]+)\}/g, function (m, qt) {
        var k2 = sk(qt), on = from !== to && k2.length >= 4 && vs.indexOf(k2) >= 0;
        return '<span class="q' + (on ? ' cur' : '') + '">﴿' + qt.trim() + '﴾</span>';
      });
      el.innerHTML = '<div class="muted small">أنوار التنزيل وأسرار التأويل، للبيضاوي</div>' + note + body;
      var c = el.querySelector('.cur'); el.scrollTop = c ? Math.max(0, c.offsetTop - 40) : 0;
    }).catch(fail);
  }

  function rootView(key) {
    Promise.all([loadIdx(), loadRG()]).then(function () {
      document.title = keyLabel(key) + ' | مفردات القرآن الكريم';
      var E = entriesFor(key);
      app.innerHTML = '<section class="card"><h1>' + esc(keyLabel(key)) + '</h1>' + (E.length ? E.map(entryHTML).join('') : '<p class="muted">لا مدخل له في «المفردات».</p>') + '</section>' +
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
    Promise.all([loadIdx(), loadRG()]).then(function () {
      var q = raw.trim(); if (!q) return home();
      var m = q.match(/^(\d{1,3})\s*[:：\/ ]\s*(\d{1,3})$/);
      if (m) { location.hash = '#' + m[1] + ':' + m[2]; return; }
      m = q.match(/^(.+?)\s+(\d{1,3})$/);
      if (m && (SN[nz(m[1])] || SN[nz(m[1]).replace(/^ال/, '')])) { location.hash = '#' + (SN[nz(m[1])] || SN[nz(m[1]).replace(/^ال/, '')]) + ':' + m[2]; return; }
      var n = nz(q).replace(/\s+/g, ' '), keys = [], how = '';
      if (IDX.F[n]) { keys = IDX.F[n].slice(); how = 'الكلمة بنصها في المصحف'; }
      if (!keys.length) for (var p = 0; p < PREF.length && !keys.length; p++) if (n.indexOf(PREF[p]) === 0 && n.length - PREF[p].length >= 2 && IDX.F[n.slice(PREF[p].length)]) { keys = IDX.F[n.slice(PREF[p].length)].slice(); how = 'بعد حذف السابقة «' + PREF[p] + '»'; }
      if (!keys.length) for (var p2 = 0; p2 < PREF.length && !keys.length; p2++) if (IDX.F[PREF[p2] + n]) { keys = IDX.F[PREF[p2] + n].slice(); how = 'الكلمة في المصحف بالسابقة «' + PREF[p2] + '»'; }
      if (!keys.length && n.length >= 3 && !KEYN[n]) {
        var cnt = {};
        Object.keys(IDX.F).forEach(function (f) { if (f.indexOf(n) >= 0) IDX.F[f].forEach(function (k) { cnt[k] = (cnt[k] || 0) + 1; }); });
        keys = Object.keys(cnt).sort(function (x, y) { return cnt[y] - cnt[x]; });
        if (keys.length) how = 'كلمات في المصحف تحتوي «' + q + '»';
      }
      if (KEYN[n] && keys.indexOf(KEYN[n]) < 0) { keys.unshift(KEYN[n]); how = how || 'جذر'; }
      var heads = (RG.HN[n] || []).filter(function (i) { return !keys.some(function (k) { return entriesFor(k).indexOf(i) >= 0; }); });
      var full = [];
      if (!keys.length && !heads.length && n.length >= 3) RG.T.forEach(function (t, i) { if (full.length < 40 && nz(t).indexOf(n) >= 0) full.push(i); });
      document.title = q + ' | مفردات القرآن الكريم';
      var html = '<section class="card"><h1>«' + esc(q) + '»</h1>' + (how ? '<p class="muted">وُجدت: ' + esc(how) + '.</p>' : '') + '</section>';
      keys.slice(0, 4).forEach(function (k) {
        var E = entriesFor(k);
        html += '<section class="card"><h2>' + esc(keyLabel(k)) + '</h2>' + (E.length ? E.map(entryHTML).join('') : '<p class="muted">لا مدخل له في «المفردات».</p>') + '<h3>المواضع</h3>' + refsHTML(k, 10) + '</section>';
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
      '<li><strong>«الميسر في غريب القرآن»</strong>: النص الرقمي من مجموعة QUL (Tarteel)، ولا تذكر المجموعة معلومات حقوقه، فيحتاج ترخيص نشره إلى تحقق من الناشر. حُوّلت علامات الرسم العثماني في الكلمات المشروحة إلى علامات الإملاء المعتاد ليُحسن عرضها.</li>' +
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
  document.getElementById('sform').onsubmit = function (e) { e.preventDefault(); var v = document.getElementById('q').value.trim(); if (v) location.hash = '#w/' + encodeURIComponent(v); };
  window.addEventListener('hashchange', function () { route(); window.scrollTo(0, 0); });
  route();
})();
