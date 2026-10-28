/* Asked: the question engine. Licensed under AGPL-3.0.
   Implements the Asked Method: search demand from autocomplete, predicted fan-out
   along the B2B evaluation path, evidence labels, answer formats and ranking. */
(function () {
  'use strict';

  var GEMINI_MODEL = 'gemini-2.5-flash';
  var TIMEOUT = 6000;

  var FACETS = ['Fit And Function', 'Cost', 'Security And Compliance', 'Integration And Rollout', 'Alternatives And Trade-Offs', 'Proof And Outcomes'];
  var LABEL_ORDER = { 'Confirmed': 0, 'Search Demand': 1, 'Predicted Fan-Out': 2 };

  /* Facet patterns, checked in this order. */
  var FACET_RULES = [
    ['Security And Compliance', /\b(secur\w*|complian\w*|gdpr|hipaa|soc ?2|iso ?27001|encrypt\w*|privacy|audit\w*|risk\w*|sso|saml|data residency|certif\w*)\b/],
    ['Cost', /\b(pric\w*|cost\w*|cheap\w*|free|how much|budget|fees?|subscription|per (user|seat|employee|month))\b/],
    ['Integration And Rollout', /\b(integrat\w*|api|connect\w*|set ?up|implement\w*|migrat\w*|install\w*|onboard\w*|deploy\w*|how long|time to|works? with|sync\w*|plugin|configur\w*)\b/],
    ['Alternatives And Trade-Offs', /\b(vs|versus|alternativ\w*|compar\w*|competitor\w*|better than|best|top|or)\b/],
    ['Proof And Outcomes', /\b(roi|benefit\w*|result\w*|case stud\w*|reviews?|worth|saving\w*|metrics?|statistic\w*|success|outcome\w*|pros|cons)\b/],
    ['Fit And Function', /\b(what (is|are)|meaning|defin\w*|how (does|do) .* work|for (small|startups?|enterprise\w*|teams?|smb\w*|business\w*)|use cases?|types?|features?|examples?|who (uses|needs))\b/]
  ];

  /* Built-in predicted fan-out, two questions per facet. */
  var TEMPLATES = {
    'Fit And Function': ['What is {kw}?', 'Who is {kw} best suited for?'],
    'Cost': ['How much does {kw} cost?', 'How is {kw} usually priced?'],
    'Security And Compliance': ['Which security and compliance standards apply to {kw}?', 'Is data handled securely in {kw}?'],
    'Integration And Rollout': ['How long does it take to implement {kw}?', 'Does {kw} integrate with existing tools?'],
    'Alternatives And Trade-Offs': ['What are the main alternatives to {kw}?', 'How do you choose between {kw} options?'],
    'Proof And Outcomes': ['What results can teams expect from {kw}?', 'How do you measure the ROI of {kw}?']
  };

  var SEEDS = ['{kw}', 'what is {kw}', 'how {kw}', 'how much {kw}', 'how long {kw}', 'is {kw}', 'can {kw}', 'which {kw}', 'best {kw}',
    '{kw} vs', '{kw} for', '{kw} pricing', '{kw} security', '{kw} compliance', '{kw} integration', '{kw} implementation', '{kw} alternatives', '{kw} benefits'];

  var ENTITIES = ['AWS', 'Azure', 'Google Cloud', 'GCP', 'Salesforce', 'HubSpot', 'Slack', 'QuickBooks', 'Xero', 'NetSuite', 'Snowflake', 'BigQuery',
    'Databricks', 'Redshift', 'Postgres', 'MySQL', 'MongoDB', 'GDPR', 'HIPAA', 'SOC 2', 'ISO 27001', 'SSO', 'SAML', 'Okta', 'Jira', 'Shopify', 'Stripe',
    'SAP', 'Oracle', 'Workday', 'Zendesk', 'Kubernetes', 'Excel', 'Microsoft 365', 'Teams', 'Gmail', 'Outlook', 'Zapier', 'Power BI', 'Tableau',
    'ADP', 'Gusto', 'Rippling', 'Vanta', 'Drata', 'Datadog', 'Terraform', 'GitHub', 'FinOps', 'PCI DSS', 'CCPA', 'NIST'];

  var QUESTION_START = /^(what|how|which|who|why|when|where|is|are|can|does|do|should|will)\b/;

  function norm(s) { return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function tokens(s) { return norm(s).split(' ').filter(function (t) { return t.length > 2 && STOP.indexOf(t) < 0; }); }
  var STOP = ['the', 'and', 'for', 'what', 'how', 'does', 'are', 'can', 'which', 'with', 'your', 'you', 'from', 'that', 'this', 'into', 'its', 'who', 'why', 'when', 'where', 'should', 'will'];
  function similarity(a, b) {
    var A = tokens(a), B = tokens(b);
    if (!A.length || !B.length) return 0;
    var inter = A.filter(function (t) { return B.indexOf(t) >= 0; }).length;
    return inter / (A.length + B.length - inter);
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function facetOf(text, kw) {
    var t = norm(text);
    if (kw) { t = (' ' + t + ' ').replace(' ' + norm(kw) + ' ', ' ').trim(); }
    for (var i = 0; i < FACET_RULES.length; i++) { if (FACET_RULES[i][1].test(t)) return FACET_RULES[i][0]; }
    return null;
  }

  function formatOf(q) {
    var t = norm(q);
    if (/\b(vs|versus|alternative|alternatives|compare|comparison|best for)\b/.test(t)) return 'Comparison';
    if (/^how (much|long|many)\b/.test(t)) return 'Figure';
    if (/^what (is|does)\b/.test(t)) return 'Definition';
    if (/^how (to|do|does|can|should|is)\b/.test(t)) return 'Process';
    if (/^(can|does|do|is|are|will|should)\b/.test(t)) return 'Conditional Answer';
    return 'Criteria';
  }

  /* Turns a typed autocomplete phrase into a question a section can answer. */
  function toQuestion(phrase, kw) {
    var p = phrase.trim().replace(/\s+/g, ' ');
    var t = norm(p);
    if (QUESTION_START.test(t)) return cap(p.replace(/\?+$/, '')) + '?';
    var k = norm(kw);
    var rest = t.indexOf(k) >= 0 ? t.replace(k, '').replace(/\s+/g, ' ').trim() : t;
    var m;
    if ((m = rest.match(/^(?:vs|versus) (.+)$/))) return cap(kw) + ' vs ' + m[1] + ': which fits?';
    if (/^alternativ/.test(rest)) return 'What are the best alternatives to ' + kw + '?';
    if ((m = rest.match(/^(?:best |top )?(?:for) (.+)$/))) return 'Which ' + kw + ' works best for ' + m[1] + '?';
    if (/^(pric\w*|cost\w*)/.test(rest)) {
      var tail = rest.replace(/^(pric\w*|cost\w*)\s*/, '');
      return 'How much does ' + kw + ' cost' + (tail ? ' ' + tail : '') + '?';
    }
    if ((m = rest.match(/^integrat\w* (?:with )?(.+)$/))) return 'Does ' + kw + ' integrate with ' + m[1] + '?';
    if (/^integrat/.test(rest)) return 'Which tools does ' + kw + ' integrate with?';
    if (/^(implement\w*|set ?up|deploy\w*|onboard\w*|migrat\w*)/.test(rest)) return 'How do you implement ' + kw + '?';
    if (/^(secur\w*|complian\w*|privacy|risk\w*)/.test(rest)) return 'How does ' + kw + ' handle ' + rest + '?';
    if (/^(benefit\w*|roi|advantag\w*)/.test(rest)) return 'What are the benefits of ' + kw + '?';
    if (/^reviews?/.test(rest)) return 'What do reviews say about ' + kw + '?';
    if (/^(best|top)$/.test(rest) || /^(best|top) /.test(t)) return 'Which ' + kw + ' is best' + (rest.replace(/^(best|top)\s*/, '') ? ' ' + rest.replace(/^(best|top)\s*/, '') : '') + '?';
    if ((m = rest.match(/^(tools?|software|platforms?|solutions?|vendors?|companies|providers?|apps?)$/))) return 'Which ' + kw + ' ' + m[1] + ' are worth shortlisting?';
    if (!rest) return 'What is ' + kw + '?';
    return 'What should buyers know about ' + p + '?';
  }

  /* JSONP loader: autocomplete endpoints do not allow cross-site fetch. */
  var jsonpId = 0;
  function jsonp(url, cbParam) {
    return new Promise(function (resolve, reject) {
      var name = '__askedcb' + (++jsonpId);
      var s = document.createElement('script');
      var done = false;
      var timer = setTimeout(function () { finish(); reject(new Error('timeout')); }, TIMEOUT);
      function finish() {
        done = true; clearTimeout(timer);
        try { delete window[name]; } catch (e) { window[name] = undefined; }
        if (s.parentNode) s.parentNode.removeChild(s);
      }
      window[name] = function (data) { if (done) return; finish(); resolve(data); };
      s.onerror = function () { if (done) return; finish(); reject(new Error('network')); };
      s.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + cbParam + '=' + name;
      document.head.appendChild(s);
    });
  }

  function googleSuggest(q, gl) {
    var url = 'https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=' + encodeURIComponent(gl) + '&q=' + encodeURIComponent(q);
    return jsonp(url, 'callback').then(function (d) { return (d && d[1]) || []; });
  }
  function bingSuggest(q, gl) {
    var url = 'https://api.bing.com/osjson.aspx?JsonType=callback&cc=' + encodeURIComponent(gl) + '&query=' + encodeURIComponent(q);
    return jsonp(url, 'JsonCallback').then(function (d) { return (d && d[1]) || []; });
  }

  function pool(tasks, limit) {
    var i = 0, out = new Array(tasks.length);
    function worker() {
      if (i >= tasks.length) return Promise.resolve();
      var idx = i++;
      return tasks[idx]().then(function (r) { out[idx] = { ok: true, value: r }; }, function () { out[idx] = { ok: false, value: [] }; }).then(worker);
    }
    var workers = [];
    for (var w = 0; w < limit; w++) workers.push(worker());
    return Promise.all(workers).then(function () { return out; });
  }

  function collectDemand(kw, gl) {
    var seeds = SEEDS.map(function (s) { return s.replace('{kw}', kw); });
    var tasks = [];
    seeds.forEach(function (s) {
      tasks.push(function () { return googleSuggest(s, gl).then(function (r) { return { src: 'Google', items: r }; }); });
      tasks.push(function () { return bingSuggest(s, gl).then(function (r) { return { src: 'Bing', items: r }; }); });
    });
    return pool(tasks, 6).then(function (results) {
      var seen = {}, phrases = [], googleOk = false, bingOk = false;
      var keyTokens = tokens(kw);
      results.forEach(function (r, idx) {
        if (!r.ok) return;
        var src = idx % 2 === 0 ? 'Google' : 'Bing';
        if (src === 'Google') googleOk = true; else bingOk = true;
        (r.value.items || []).forEach(function (phrase) {
          if (typeof phrase !== 'string') return;
          var n = norm(phrase);
          if (!n || n === norm(kw)) return;
          var hits = keyTokens.filter(function (t) { return n.indexOf(t) >= 0; }).length;
          if (keyTokens.length && hits < Math.ceil(keyTokens.length / 2)) return;
          if (seen[n]) { if (seen[n].sources.indexOf(src) < 0) seen[n].sources.push(src); return; }
          seen[n] = { phrase: phrase, sources: [src] };
          phrases.push(seen[n]);
        });
      });
      return { phrases: phrases, googleOk: googleOk, bingOk: bingOk };
    });
  }

  function builtInFanOut(kw) {
    var out = [];
    FACETS.forEach(function (f) {
      TEMPLATES[f].forEach(function (t) { out.push({ text: t.replace('{kw}', kw), facet: f }); });
    });
    return Promise.resolve({ predicted: out, entities: [], opened: FACETS.slice() });
  }

  function geminiFanOut(kw, key) {
    var prompt = 'You plan B2B content for AI search. For the keyword "' + kw + '", predict the sub-questions an answer engine such as Google AI Mode is likely to run when a B2B buyer researches it. ' +
      'Work through these facets of a software or services evaluation: ' + FACETS.join(', ') + '. Only include facets that genuinely apply. ' +
      'Write 1 to 3 short, specific questions per facet, phrased the way a buyer would ask. Also list up to 8 named standards, tools, vendors or terms a credible answer should mention. ' +
      'Return JSON only: {"questions":[{"q":"...","facet":"one of the facet names"}],"entities":["..."]}';
    return fetch('https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.4 } })
    }).then(function (res) {
      if (res.status === 400 || res.status === 401 || res.status === 403) throw new Error('key');
      if (res.status === 429) throw new Error('limit');
      if (!res.ok) throw new Error('gemini');
      return res.json();
    }).then(function (data) {
      var text = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0].text;
      var parsed = JSON.parse(text);
      var predicted = (parsed.questions || []).filter(function (x) { return x && x.q && FACETS.indexOf(x.facet) >= 0; })
        .map(function (x) { return { text: cap(x.q.trim().replace(/\?*$/, '?')), facet: x.facet }; });
      if (!predicted.length) throw new Error('gemini');
      var opened = FACETS.filter(function (f) { return predicted.some(function (p) { return p.facet === f; }); });
      return { predicted: predicted, entities: (parsed.entities || []).slice(0, 8), opened: opened };
    });
  }

  function findEntities(texts) {
    var joined = ' ' + texts.join(' ').toLowerCase() + ' ';
    return ENTITIES.filter(function (e) {
      var re = new RegExp('[^a-z0-9]' + e.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^a-z0-9]');
      return re.test(joined);
    }).slice(0, 8);
  }

  function properCase(text) {
    ENTITIES.forEach(function (e) {
      var re = new RegExp('(^|[^A-Za-z0-9])' + e.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=[^A-Za-z0-9]|$)', 'gi');
      text = text.replace(re, function (m, pre) { return pre + e; });
    });
    return text;
  }

  function dedupe(list) {
    var kept = [];
    list.forEach(function (q) {
      var dup = kept.some(function (k) { return norm(k.text) === norm(q.text) || similarity(k.text, q.text) >= 0.75; });
      if (!dup) kept.push(q);
    });
    return kept;
  }

  /* Runs the full method. onStage(index) reports progress: 0 collect, 1 predict, 2 match, 3 build. */
  function run(kw, opts) {
    opts = opts || {};
    var gl = opts.gl || 'us';
    var stage = opts.onStage || function () {};
    var notices = [];
    stage(0);
    return collectDemand(kw, gl).then(function (demand) {
      if (!demand.googleOk && !demand.bingOk) notices.push('sources-busy');
      stage(1);
      var predict = opts.engine === 'gemini' && opts.key
        ? geminiFanOut(kw, opts.key).catch(function (err) {
            notices.push(err.message === 'key' ? 'key-rejected' : (err.message === 'limit' ? 'key-limit' : 'gemini-failed'));
            return builtInFanOut(kw);
          })
        : builtInFanOut(kw);
      return predict.then(function (fan) { return { demand: demand, fan: fan }; });
    }).then(function (r) {
      stage(2);
      var questions = [];
      r.demand.phrases.forEach(function (p) {
        var facet = facetOf(p.phrase, kw);
        var text = properCase(toQuestion(p.phrase, kw));
        var opened = facet && r.fan.opened.indexOf(facet) >= 0;
        questions.push({
          text: text,
          label: opened ? 'Confirmed' : 'Search Demand',
          facet: facet || 'Fit And Function',
          format: formatOf(text),
          source: 'Seen in ' + p.sources.join(' and ') + ' autocomplete as “' + p.phrase + '”',
          typed: p.phrase
        });
      });
      questions = dedupe(questions);
      var confirmed = questions.filter(function (q) { return q.label === 'Confirmed'; }).slice(0, 10);
      var demandOnly = questions.filter(function (q) { return q.label === 'Search Demand'; }).slice(0, 6);
      var predicted = r.fan.predicted.filter(function (p) {
        return !confirmed.concat(demandOnly).some(function (c) {
          return similarity(c.text, p.text) >= 0.5 || (c.facet === p.facet && c.format === formatOf(p.text));
        });
      }).map(function (p) {
        return { text: p.text, label: 'Predicted Fan-Out', facet: p.facet, format: formatOf(p.text), source: 'Predicted by the model' };
      });
      predicted = dedupe(predicted);
      stage(3);
      var all = confirmed.concat(demandOnly, predicted).slice(0, 18);
      all.sort(function (a, b) {
        return (LABEL_ORDER[a.label] - LABEL_ORDER[b.label]) || (FACETS.indexOf(a.facet) - FACETS.indexOf(b.facet));
      });
      var entities = r.fan.entities.length ? r.fan.entities : findEntities(all.map(function (q) { return q.typed || q.text; }));
      return {
        keyword: kw, gl: gl,
        engine: opts.engine === 'gemini' && opts.key && notices.indexOf('key-rejected') < 0 && notices.indexOf('key-limit') < 0 && notices.indexOf('gemini-failed') < 0 ? 'Gemini' : 'Built-In Engine',
        date: new Date().toISOString(),
        questions: all.map(function (q, i) { return { id: i, text: q.text, label: q.label, facet: q.facet, format: q.format, source: q.source, include: true }; }),
        entities: entities,
        notices: notices
      };
    });
  }

  window.AskedEngine = { run: run, properCase: properCase, formatOf: formatOf, toQuestion: toQuestion, facetOf: facetOf, similarity: similarity, norm: norm, FACETS: FACETS };
})();
