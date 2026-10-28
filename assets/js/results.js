/* Asked: results page. Licensed under AGPL-3.0. */
(function () {
  'use strict';
  var S = window.AskedStore, E = window.AskedEngine;
  var params = new URLSearchParams(location.search);
  var q = (params.get('q') || '').trim();
  var gl = (params.get('gl') || S.get('market', 'us')).toLowerCase();
  var MARKETS = { us: 'United States', gb: 'United Kingdom', in: 'India', ca: 'Canada', au: 'Australia', sg: 'Singapore' };
  if (!MARKETS[gl]) gl = 'us';
  if (!q) { location.replace('../'); return; }
  S.set('market', gl);

  var $ = function (id) { return document.getElementById(id); };
  $('rq').value = q;
  $('gl').value = gl;

  var CHECK = '<circle cx="12" cy="12" r="9" stroke="#FF7A45"/><path d="M8 12.5l2.5 2.5L16 9.5" stroke="#FF7A45"/>';
  var SPIN = '<path d="M21 12a9 9 0 1 1-9-9" stroke="#FF7A45"/>';
  var IDLE = '<circle cx="12" cy="12" r="9" stroke="rgba(238,241,248,.35)"/>';
  function setStage(n) {
    document.querySelectorAll('.load-step').forEach(function (el) {
      var i = +el.getAttribute('data-stage');
      el.classList.toggle('done', i < n);
      el.classList.toggle('active', i === n);
      el.querySelector('svg').innerHTML = i < n ? CHECK : (i === n ? SPIN : IDLE);
    });
    $('progress').style.width = Math.round(((n + 0.5) / 4) * 100) + '%';
  }

  var state = null, ev = 'All', facet = 'All';
  var engine = S.get('engine', 'builtin'), key = S.get('key', '');
  var cacheKey = 'run:' + engine + ':' + gl + ':' + E.norm(q);

  function save() { S.set('current', state); }

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function kind(label) { return label === 'Confirmed' ? 'confirmed' : (label === 'Search Demand' ? 'demand' : 'predicted'); }
  function titleCase(s) { return s.replace(/\w\S*/g, function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }); }

  var NOTICE = {
    'sources-busy': ['Search Sources Busy', 'The search sources are busy right now. Your brief can still be built from predicted fan-out alone, or you can try again in a minute.', '<a href="#" data-dismiss>Build Without Search Data</a><a href="#" data-retry style="color:rgba(238,241,248,.7)">Try Again</a>'],
    'key-rejected': ['Key Not Accepted', 'Google didn’t accept this key. Check it in Google AI Studio and paste it again. These results use the built-in engine.', '<a href="#" data-open-settings>Open Settings</a>'],
    'key-limit': ['Key Limit Reached', 'Your Gemini key has hit its free limit for now. These results use the built-in engine, so try your key again later.', '<a href="#" data-open-settings>Open Settings</a>'],
    'gemini-failed': ['Gemini Unavailable', 'Gemini didn’t respond this time, so these results use the built-in engine. Try again in a minute.', '<a href="#" data-retry>Try Again</a>']
  };

  function renderNotices() {
    var box = $('notices');
    box.innerHTML = '';
    var list = state.notices.slice();
    if (!navigator.onLine) list.unshift('offline');
    list.forEach(function (n) {
      var div = document.createElement('div');
      div.className = 'notice';
      if (n === 'offline') {
        div.style.borderColor = 'var(--line)';
        div.innerHTML = '<p class="t" style="color:var(--bone)">Offline</p><p>You’re offline. Reconnect to run a new search. Briefs you’ve already built are still here.</p>';
      } else if (NOTICE[n]) {
        div.innerHTML = '<p class="t">' + NOTICE[n][0] + '</p><p>' + NOTICE[n][1] + '</p><div class="acts">' + NOTICE[n][2] + '</div>';
      }
      box.appendChild(div);
    });
    box.querySelectorAll('[data-dismiss]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); a.closest('.notice').remove(); }); });
    box.querySelectorAll('[data-retry]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); try { sessionStorage.removeItem(cacheKey); } catch (x) {} location.reload(); }); });
    box.querySelectorAll('[data-open-settings]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); document.querySelector('.icon-btn[data-open-settings]').click(); }); });
  }

  function renderFilters() {
    var evs = ['All', 'Confirmed', 'Search Demand', 'Predicted Fan-Out'];
    $('f-ev').innerHTML = evs.map(function (n) { return '<button type="button" class="fchip" aria-pressed="' + (n === ev) + '" data-ev="' + n + '">' + n + '</button>'; }).join('');
    var fs = ['All'].concat(E.FACETS);
    $('f-facet').innerHTML = fs.map(function (n) { return '<button type="button" class="frow" aria-pressed="' + (n === facet) + '" data-facet="' + n + '">' + n + '</button>'; }).join('');
    $('f-ev').querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { ev = b.getAttribute('data-ev'); renderFilters(); renderList(); }); });
    $('f-facet').querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { facet = b.getAttribute('data-facet'); renderFilters(); renderList(); }); });
  }

  function renderCount() {
    var inc = state.questions.filter(function (x) { return x.include; }).length;
    $('r-count').textContent = inc + ' of ' + state.questions.length + ' included.';
  }

  function renderList() {
    var shown = state.questions.filter(function (x) { return (ev === 'All' || x.label === ev) && (facet === 'All' || x.facet === facet); });
    var list = $('qlist');
    if (!shown.length) { list.innerHTML = '<p class="empty">No questions match these filters. Try another facet or evidence label.</p>'; return; }
    list.innerHTML = shown.map(function (x, i) {
      var k = kind(x.label);
      var first = i === 0;
      return '<article class="qcard' + (x.include ? '' : ' off') + '" data-id="' + x.id + '">' +
        '<div style="flex:1 1 auto;min-width:0">' +
        '<div class="tags">' +
        '<a class="pill lab ' + k + '" href="../method/#m4" title="Why this label?"' + (first ? ' id="tour-chip"' : '') + '><span class="dot ' + k + '" aria-hidden="true"></span>' + x.label + '</a>' +
        '<span class="pill">' + x.facet + '</span>' +
        '<span class="pill"' + (first ? ' id="tour-format"' : '') + '>' + x.format + '</span>' +
        '</div>' +
        '<p class="qtext" data-text>' + esc(x.text) + '</p>' +
        '<p class="qsrc">' + esc(x.source) + '</p>' +
        '</div>' +
        '<div class="qside">' +
        '<button type="button" class="switch" role="switch" aria-checked="' + x.include + '" aria-label="Include In Brief"' + (first ? ' id="tour-toggle"' : '') + '><span></span></button>' +
        '<span class="side-lbl">Include In Brief</span>' +
        '<button type="button" class="edit-btn" aria-label="Edit question"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l4-1 11-11-3-3L5 16z"/></svg>Edit</button>' +
        '</div></article>';
    }).join('');
    list.querySelectorAll('.qcard').forEach(function (card) {
      var item = state.questions[+card.getAttribute('data-id')];
      card.querySelector('.switch').addEventListener('click', function (e) {
        item.include = !item.include;
        e.currentTarget.setAttribute('aria-checked', item.include);
        card.classList.toggle('off', !item.include);
        save(); renderCount();
      });
      var text = card.querySelector('[data-text]');
      card.querySelector('.edit-btn').addEventListener('click', function () {
        text.setAttribute('contenteditable', 'true');
        text.focus();
        var r = document.createRange(); r.selectNodeContents(text); r.collapse(false);
        var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      });
      text.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); text.blur(); } });
      text.addEventListener('blur', function () {
        text.removeAttribute('contenteditable');
        var v = text.textContent.trim();
        if (v) { item.text = v; item.format = E.formatOf(v); save(); }
        else { text.textContent = item.text; }
      });
    });
  }

  function render() {
    $('loading').hidden = true;
    $('results').hidden = false;
    document.title = 'Questions For ' + titleCase(state.keyword) + ' · Asked';
    $('r-title').textContent = 'Questions For ' + titleCase(state.keyword);
    var d = new Date(state.date);
    $('r-meta').textContent = MARKETS[state.gl] + ' · ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + state.engine;
    var conf = state.questions.filter(function (x) { return x.label === 'Confirmed'; }).length;
    $('r-summary').innerHTML = state.questions.length + ' questions found, <span class="brand">' + conf + ' confirmed</span> by both signals';
    renderNotices(); renderFilters(); renderList(); renderCount();
    document.dispatchEvent(new CustomEvent('asked:results-ready'));
  }

  var cached = null;
  try { cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null'); } catch (e) { cached = null; }
  var current = S.get('current', null);
  if (current && current.keyword === q && current.gl === gl && cached) { state = current; render(); return; }
  if (cached) { state = cached; save(); render(); return; }

  setStage(0);
  E.run(q, { gl: gl, engine: engine, key: key, onStage: setStage }).then(function (res) {
    state = res;
    try { sessionStorage.setItem(cacheKey, JSON.stringify(res)); } catch (e) {}
    save();
    setStage(4);
    setTimeout(render, 250);
  }).catch(function () {
    $('loading').innerHTML = '<p class="t" style="margin:0 0 8px;font-weight:500">No Questions Found</p><p style="margin:0;font-size:14px;color:var(--mute)">We couldn’t find enough questions for this keyword. Try a more specific phrase, or one buyers would actually type.</p>';
  });
})();
