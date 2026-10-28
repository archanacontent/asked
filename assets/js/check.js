/* Asked: Check Predictions. Licensed under AGPL-3.0. */
(function () {
  'use strict';
  var S = window.AskedStore, E = window.AskedEngine;
  var $ = function (id) { return document.getElementById(id); };
  var REPO_ISSUES = 'https://github.com/archanacontent/asked/issues/new';
  var lastResult = null;

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lines(v) { return v.split(/\r?\n/).map(function (l) { return l.replace(/^[\s\-*\d.)]+/, '').replace(/\s*\(.*?\)\s*$/, '').trim(); }).filter(Boolean); }

  function questionsFromBrief(text) {
    var out = [], inMust = false;
    text.split(/\r?\n/).forEach(function (raw) {
      var l = raw.trim();
      if (/^#*\s*must-answer questions/i.test(l)) { inMust = true; return; }
      if (/^#*\s*(suggested outline|facts and entities|writing rules)/i.test(l)) { inMust = false; return; }
      var q = l.replace(/^[\s\-*\d.)]+/, '').replace(/\s*\((?:[^()]*)\)\s*$/, '').trim();
      if (inMust && q) out.push(q);
      else if (!inMust && /\?$/.test(q) && out.indexOf(q) < 0 && !/^H2:/i.test(q)) out.push(q);
    });
    return out.filter(function (q, i) { return out.indexOf(q) === i; });
  }

  function keywordFromBrief(text) {
    var m = text.match(/Content Brief For (.+)/i);
    return m ? m[1].trim() : '';
  }

  $('reopen').addEventListener('click', function (e) {
    e.preventDefault();
    var st = S.get('current', null);
    if (!st) { $('check-error').textContent = 'No brief is saved in this browser yet. Paste the one you exported.'; $('check-error').hidden = false; return; }
    var inc = st.questions.filter(function (x) { return x.include; });
    $('cr').value = 'Content Brief For ' + st.keyword + '\n\nMust-Answer Questions\n' + inc.map(function (x, i) { return (i + 1) + '. ' + x.text; }).join('\n');
    $('check-error').hidden = true;
  });

  var STOP = ['the', 'and', 'for', 'what', 'how', 'does', 'are', 'can', 'which', 'with', 'your', 'you', 'from', 'that', 'this', 'into', 'its', 'who', 'why', 'when', 'where', 'should', 'will', 'is', 'do', 'a', 'an', 'to', 'of', 'in', 'on', 'it', 'or', 'vs', 'best'];
  function core(s, kwTokens) {
    return E.norm(s).split(' ').filter(function (t) { return t && STOP.indexOf(t) < 0 && kwTokens.indexOf(t) < 0; })
      .map(function (t) { return t.replace(/(ing|es|s)$/, ''); });
  }
  function matches(q, query, kwTokens) {
    if (E.norm(q) === E.norm(query)) return true;
    var A = core(q, kwTokens), B = core(query, kwTokens);
    if (!A.length && !B.length) return true;
    if (!A.length || !B.length) return false;
    var inter = A.filter(function (t) { return B.indexOf(t) >= 0; }).length;
    return inter / (A.length + B.length - inter) >= 0.5;
  }

  $('check-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('check-error');
    var queries = lines($('cb').value).concat(lines($('cg').value));
    var briefText = $('cr').value;
    var qs = questionsFromBrief(briefText);
    if (!queries.length) { err.textContent = 'Paste at least one query from Bing or Search Console.'; err.hidden = false; return; }
    if (!qs.length) { err.textContent = 'Paste your brief, or reopen it from this browser.'; err.hidden = false; return; }
    err.hidden = true;

    var kwTokens = E.norm(keywordFromBrief(briefText)).split(' ').filter(Boolean);
    var surfaced = [], unseen = [], used = {};
    qs.forEach(function (q) {
      var hit = queries.filter(function (x) { return matches(q, x, kwTokens); });
      if (hit.length) { surfaced.push(q); hit.forEach(function (h) { used[h] = true; }); } else unseen.push(q);
    });
    var unexpected = queries.filter(function (x, i) { return !used[x] && queries.indexOf(x) === i; }).slice(0, 20);
    var kw = keywordFromBrief(briefText) || 'Your Brief';
    lastResult = { keyword: kw, surfaced: surfaced, notYetSeen: unseen, unexpectedCount: unexpected.length, tool: 'Asked', method: 'v1' };

    $('cr-title').textContent = 'Content Brief For ' + kw.replace(/^content brief for /i, '');
    function fill(id, arr) { $(id).innerHTML = arr.length ? arr.map(function (x) { return '<p class="res-item">' + esc(x) + '</p>'; }).join('') : '<p class="res-item" style="color:var(--soft);background:transparent;padding-left:0">None</p>'; }
    fill('r-surfaced', surfaced); fill('r-unseen', unseen); fill('r-unexpected', unexpected);
    $('no-matches').hidden = surfaced.length > 0;
    $('check-results').hidden = false;
    document.querySelectorAll('[data-share-ask]').forEach(function (el) { el.hidden = false; });
    $('share-status').hidden = true;
    $('check-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  $('share').addEventListener('click', function () {
    if (!lastResult) return;
    var body = 'Prediction result shared from Asked.\n\n```json\n' + JSON.stringify(lastResult, null, 2) + '\n```\n';
    var url = REPO_ISSUES + '?labels=' + encodeURIComponent('prediction-result') + '&title=' + encodeURIComponent('Prediction result: ' + lastResult.keyword) + '&body=' + encodeURIComponent(body);
    window.open(url, '_blank', 'noopener');
    document.querySelectorAll('[data-share-ask]').forEach(function (el) { el.hidden = true; });
    $('share-status').innerHTML = 'A pre-filled GitHub issue opened in a new tab. Submit it there to add your results to the open dataset.';
    $('share-status').hidden = false;
  });
  $('no-thanks').addEventListener('click', function () {
    document.querySelectorAll('[data-share-ask]').forEach(function (el) { el.hidden = true; });
    $('share-status').textContent = 'Nothing was shared. Your results stay in this browser.';
    $('share-status').hidden = false;
  });
})();
