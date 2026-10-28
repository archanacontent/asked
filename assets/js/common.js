/* Asked: shared behaviour for every page. Licensed under AGPL-3.0. */
(function () {
  'use strict';

  var BASE = document.body.getAttribute('data-base') || '';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var store = {
    get: function (k, fallback) {
      try { var v = localStorage.getItem('asked.' + k); return v === null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set: function (k, v) {
      try { localStorage.setItem('asked.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ }
    },
    remove: function (k) {
      try { localStorage.removeItem('asked.' + k); } catch (e) { /* storage unavailable */ }
    }
  };
  window.AskedStore = store;
  window.AskedBase = BASE;

  /* Typing placeholder: cycles example keywords until the field is used. */
  var WORDS = ['CRM software', 'payroll software', 'data warehouse migration', 'SOC 2 compliance', 'cloud cost management'];
  document.querySelectorAll('input[data-typing]').forEach(function (input) {
    if (reduceMotion) { input.placeholder = WORDS[0]; return; }
    var w = 0, c = 0, del = false, pause = 0, stopped = false;
    function tick() {
      if (stopped) return;
      if (pause > 0) { pause--; return; }
      var word = WORDS[w];
      if (!del) { c++; if (c >= word.length) { del = true; pause = 22; } }
      else { c--; if (c <= 0) { del = false; w = (w + 1) % WORDS.length; pause = 5; } }
      input.placeholder = word.slice(0, c) + '|';
    }
    var timer = setInterval(tick, 80);
    input.addEventListener('focus', function () { stopped = true; input.placeholder = ''; });
    input.addEventListener('blur', function () {
      if (!input.value) { stopped = false; }
    });
    window.addEventListener('pagehide', function () { clearInterval(timer); });
  });

  /* Search forms: send the keyword to the results page. */
  document.querySelectorAll('form[data-search]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('input[name="q"]');
      var err = form.querySelector('.field-error');
      var q = (input.value || '').trim().replace(/\s+/g, ' ');
      if (q.split(' ').filter(Boolean).length < 2 || q.length < 4) {
        if (err) { err.textContent = 'Add a little more detail. A topic of two or more words works best.'; err.hidden = false; }
        input.focus();
        return;
      }
      if (err) { err.hidden = true; }
      var market = form.querySelector('select[name="gl"]');
      var gl = market ? market.value : (store.get('market', 'us'));
      window.location.href = BASE + 'results/?q=' + encodeURIComponent(q) + '&gl=' + encodeURIComponent(gl);
    });
    var input = form.querySelector('input[name="q"]');
    var err = form.querySelector('.field-error');
    if (input && err) { input.addEventListener('input', function () { err.hidden = true; }); }
  });

  /* Accordions: one panel open at a time within a group. */
  document.querySelectorAll('[data-accordion]').forEach(function (group) {
    var buttons = group.querySelectorAll('.acc-btn');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') === 'true';
        buttons.forEach(function (b) {
          b.setAttribute('aria-expanded', 'false');
          document.getElementById(b.getAttribute('aria-controls')).hidden = true;
          b.querySelector('.sign').textContent = '+';
        });
        if (!open) {
          btn.setAttribute('aria-expanded', 'true');
          document.getElementById(btn.getAttribute('aria-controls')).hidden = false;
          btn.querySelector('.sign').textContent = '−';
        }
      });
    });
  });

  /* Stepper: plays on its own, pauses after a visitor picks a step. */
  document.querySelectorAll('[data-stepper]').forEach(function (root) {
    var steps = JSON.parse(root.querySelector('script[type="application/json"]').textContent);
    var btns = root.querySelectorAll('.step-btn');
    var bars = root.querySelectorAll('.bars span');
    var title = root.querySelector('[data-step-title]');
    var num = root.querySelector('[data-step-num]');
    var desc = root.querySelector('[data-step-desc]');
    var chips = root.querySelector('[data-step-chips]');
    var body = root.querySelector('[data-step-body]');
    var current = 0, hold = 0;
    function show(i) {
      current = i;
      btns.forEach(function (b, j) { b.setAttribute('aria-selected', j === i ? 'true' : 'false'); });
      bars.forEach(function (b, j) { b.classList.toggle('on', j <= i); });
      var s = steps[i];
      num.textContent = 'STEP 0' + (i + 1);
      title.textContent = s.title;
      desc.textContent = s.desc;
      chips.innerHTML = '';
      s.chips.forEach(function (c) {
        var el = document.createElement('span');
        el.className = 'chip';
        var d = document.createElement('span');
        d.className = 'dot ' + c.kind;
        d.setAttribute('aria-hidden', 'true');
        el.appendChild(d);
        el.appendChild(document.createTextNode(c.t));
        chips.appendChild(el);
      });
      body.classList.remove('fade-in'); void body.offsetWidth; body.classList.add('fade-in');
    }
    btns.forEach(function (b, i) { b.addEventListener('click', function () { hold = 3; show(i); }); });
    show(0);
    if (!reduceMotion) {
      setInterval(function () {
        if (hold > 0) { hold--; return; }
        show((current + 1) % steps.length);
      }, 3200);
    }
  });

  /* Settings dialog, shared by the tool pages. */
  var dlg = document.getElementById('settings');
  if (dlg) {
    var keyInput = dlg.querySelector('#gemini-key');
    var status = dlg.querySelector('[data-settings-status]');
    function syncSettings() {
      var engine = store.get('engine', 'builtin');
      dlg.querySelectorAll('input[name="engine"]').forEach(function (r) { r.checked = r.value === engine; });
      keyInput.value = store.get('key', '');
      status.hidden = true;
    }
    document.querySelectorAll('[data-open-settings]').forEach(function (b) {
      b.addEventListener('click', function () { syncSettings(); dlg.showModal(); });
    });
    dlg.querySelector('[data-save-key]').addEventListener('click', function () {
      var engine = dlg.querySelector('input[name="engine"]:checked').value;
      var key = keyInput.value.trim();
      if (engine === 'gemini' && !key) {
        status.textContent = 'Paste a Gemini key first, or choose the built-in engine.';
        status.hidden = false;
        return;
      }
      store.set('engine', engine);
      if (key) store.set('key', key);
      status.textContent = engine === 'gemini' ? 'Key saved. Your next search will use it.' : 'Saved. Your next search will use the built-in engine.';
      status.hidden = false;
    });
    dlg.querySelector('[data-remove-key]').addEventListener('click', function () {
      store.remove('key');
      store.set('engine', 'builtin');
      syncSettings();
      status.textContent = 'Key removed. The built-in engine is back on.';
      status.hidden = false;
    });
    dlg.querySelector('[data-close-settings]').addEventListener('click', function () { dlg.close(); });
  }
})();
