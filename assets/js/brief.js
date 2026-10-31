/* Asked: brief page and exports. Licensed under AGPL-3.0. */
(function () {
  'use strict';
  var S = window.AskedStore;
  var $ = function (id) { return document.getElementById(id); };
  var state = S.get('current', null);
  var MARKETS = { us: 'United States', gb: 'United Kingdom', in: 'India', ca: 'Canada', au: 'Australia', sg: 'Singapore' };
  var FACETS = ['Fit And Function', 'Cost', 'Security And Compliance', 'Integration And Rollout', 'Alternatives And Trade-Offs', 'Proof And Outcomes'];
  var FOOTER = 'Brief built with Asked, a free question finder by Archana Panda. Method published under CC BY-NC 4.0.';
  var DISCLAIMER_T = 'Suggested Questions, Not Final Answers';
  var DISCLAIMER = 'These questions come from public search data and the Asked Method, so treat them as a starting point. Remove any that don\'t suit your topic or your buyers before the brief reaches a writer.';
  var RULES = ['Answer each question in the opening sentence of its section.', 'Make every passage stand alone, and name the subject in full.', 'Use specific figures, and link every one to its source.', 'Keep one question to one section.'];

  if (!state || !state.questions) { $('no-brief').hidden = false; $('back-link').href = '../'; return; }
  $('back-link').href = '../results/?q=' + encodeURIComponent(state.keyword) + '&gl=' + encodeURIComponent(state.gl);
  $('brief-wrap').hidden = false;

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function titleCase(s) {
    return s.replace(/[A-Za-z][\w'-]*/g, function (w, i) {
      if (/[A-Z].*[A-Z]/.test(w) || /\d/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    });
  }
  function kind(label) { return label === 'Confirmed' ? 'confirmed' : (label === 'Search Demand' ? 'demand' : 'predicted'); }

  var title = 'Content Brief For ' + titleCase(state.keyword);
  var date = new Date(state.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  var meta = 'Built with Asked · ' + date + ' · ' + (MARKETS[state.gl] || state.gl);
  var must = state.questions.filter(function (x) { return x.include; });
  var core = must.filter(function (x) { return x.label !== 'Search Demand'; }).slice().sort(function (a, b) { return FACETS.indexOf(a.facet) - FACETS.indexOf(b.facet); });
  var faq = must.filter(function (x) { return x.label === 'Search Demand'; });
  var outline = core.map(function (x) { return { h: titleCase(x.text), f: x.format }; });
  if (faq.length) outline.push({ h: 'Frequently Asked Questions', f: faq.length + ' short answers' });
  var entities = state.entities || [];

  document.title = title + ' · Asked';
  $('b-title').textContent = title;
  $('b-meta').innerHTML = 'Built with <span class="brand">Asked</span> · ' + esc(date) + ' · ' + esc(MARKETS[state.gl] || state.gl);
  $('b-must').innerHTML = must.map(function (x, i) {
    var k = kind(x.label);
    return '<li><span class="n">' + (i < 9 ? '0' : '') + (i + 1) + '</span><span class="q">' + esc(x.text) + '</span><span class="meta" style="display:inline-flex;gap:12px;align-items:center;font-size:11px;white-space:nowrap"><span style="color:rgba(238,241,248,.5)">' + x.format + '</span><span class="lab ' + k + '"><span class="dot ' + k + '" aria-hidden="true"></span>' + x.label + '</span></span></li>';
  }).join('') || '<li><span class="q" style="color:var(--soft)">No questions are included. Go back and switch some on.</span></li>';
  $('b-outline').innerHTML = outline.map(function (o) {
    return '<div class="outline-row"><span class="tag">H2</span><span class="h">' + esc(o.h) + '</span><span class="f">' + esc(o.f) + '</span></div>';
  }).join('');
  $('b-entities').innerHTML = entities.length
    ? entities.map(function (e) { return '<span class="entity">' + esc(e) + '</span>'; }).join('')
    : '<span style="font-size:13px;color:var(--soft)">No named tools or standards surfaced for this keyword. Add a Gemini key in settings for richer suggestions.</span>';

  function markdown() {
    var out = ['# ' + title, '', '_' + meta + '_', '', '> **' + DISCLAIMER_T + '.** ' + DISCLAIMER, '', '## Must-Answer Questions', ''];
    must.forEach(function (x, i) { out.push((i + 1) + '. ' + x.text + ' (' + x.format + ', ' + x.label + ')'); });
    out.push('', '## Suggested Outline', '');
    outline.forEach(function (o) { out.push('- H2: ' + o.h + ' (' + o.f + ')'); });
    if (faq.length) { out.push('', '### Frequently Asked Questions', ''); faq.forEach(function (x) { out.push('- ' + x.text); }); }
    out.push('', '## Facts And Entities To Include', '');
    if (entities.length) entities.forEach(function (e) { out.push('- ' + e); }); else out.push('- None surfaced for this keyword');
    out.push('', '_Suggested by the prediction engine. Verify every fact and figure before publishing._', '', '## Writing Rules', '');
    RULES.forEach(function (r) { out.push('- ' + r); });
    out.push('', 'Full standard: https://archanacontent.github.io/asked/standard/', '', '---', '', DISCLAIMER_T + '. Review every question before you write.', '', FOOTER);
    return out.join('\n');
  }
  function plain() { return markdown().replace(/^#+ /gm, '').replace(/^> /gm, '').replace(/\*\*/g, '').replace(/_/g, ''); }
  function html() {
    var h = '<h1>' + esc(title) + '</h1><p><em>' + esc(meta) + '</em></p><p><strong>' + DISCLAIMER_T + '.</strong> ' + DISCLAIMER + '</p><h2>Must-Answer Questions</h2><ol>';
    must.forEach(function (x) { h += '<li>' + esc(x.text) + ' <em>(' + x.format + ', ' + x.label + ')</em></li>'; });
    h += '</ol><h2>Suggested Outline</h2><ul>';
    outline.forEach(function (o) { h += '<li><strong>H2:</strong> ' + esc(o.h) + ' <em>(' + esc(o.f) + ')</em></li>'; });
    h += '</ul>';
    if (faq.length) { h += '<h3>Frequently Asked Questions</h3><ul>'; faq.forEach(function (x) { h += '<li>' + esc(x.text) + '</li>'; }); h += '</ul>'; }
    h += '<h2>Facts And Entities To Include</h2><ul>' + (entities.length ? entities.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') : '<li>None surfaced for this keyword</li>') + '</ul>';
    h += '<p><em>Suggested by the prediction engine. Verify every fact and figure before publishing.</em></p><h2>Writing Rules</h2><ul>' + RULES.map(function (r) { return '<li>' + r + '</li>'; }).join('') + '</ul>';
    h += '<p><a href="https://archanacontent.github.io/asked/standard/">Read the Citable Passage Standard</a></p><hr><p><strong>' + DISCLAIMER_T + '.</strong> Review every question before you write.</p><p>' + FOOTER + '</p>';
    return h;
  }

  var tm;
  function toast(msg, ok) {
    var t = $('toast');
    t.hidden = false;
    t.innerHTML = (ok ? '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF7A45" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : '') + esc(msg);
    t.style.color = ok ? 'var(--bone)' : 'var(--demand)';
    clearTimeout(tm); tm = setTimeout(function () { t.hidden = true; }, 3200);
  }
  var FAIL = 'That didn’t copy. Try again, or use Download Markdown instead.';
  var DONE = 'Copied. Paste it straight into your document.';

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta); ok ? resolve() : reject();
    });
  }

  document.querySelectorAll('[data-export]').forEach(function (b) {
    b.addEventListener('click', function () {
      var type = b.getAttribute('data-export');
      if (type === 'md') {
        var blob = new Blob([markdown()], { type: 'text/markdown' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'brief-' + state.keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.md';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        toast('Markdown file saved.', true);
      } else if (type === 'docs' && window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
        navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html()], { type: 'text/html' }), 'text/plain': new Blob([plain()], { type: 'text/plain' }) })])
          .then(function () { toast(DONE, true); }, function () { copyText(plain()).then(function () { toast(DONE, true); }, function () { toast(FAIL); }); });
      } else {
        copyText(plain()).then(function () { toast(DONE, true); }, function () { toast(FAIL); });
      }
    });
  });
})();
