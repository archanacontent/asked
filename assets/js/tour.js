/* Asked: onboarding tours, defined in tour/tours.json and rendered with Driver.js (MIT).
   Each tour shows once per visitor, can be exited at any step and replayed on demand.
   A single flag in this browser records that a tour was seen; nothing is sent anywhere. Licensed under AGPL-3.0. */
(function () {
  'use strict';
  var S = window.AskedStore;
  var which = document.body.getAttribute('data-tour');
  if (!which) return;

  function firstVisible(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el && el.getClientRects().length) return el;
    }
    return undefined;
  }

  function withDriver(cb) {
    if (window.driver && window.driver.js) return cb(window.driver.js.driver);
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      if (window.driver && window.driver.js) { clearInterval(t); cb(window.driver.js.driver); }
      else if (tries > 50) clearInterval(t);
    }, 100);
  }

  function runSteps(cfg, makeDriver) {
    var total = cfg.steps.length;
    var d = makeDriver({
      showProgress: true,
      progressText: 'Step {{current}} of {{total}}',
      popoverClass: 'asked-pop',
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Got It',
      allowClose: true,
      overlayOpacity: 0.65,
      stagePadding: 6,
      stageRadius: 12,
      steps: cfg.steps.map(function (s, i) {
        return {
          element: firstVisible(s.anchor),
          popover: { title: s.title, description: s.body, side: s.side, align: 'start', doneBtnText: s.last || 'Got It', showButtons: i === 0 ? ['next', 'close'] : ['next', 'previous', 'close'] }
        };
      }),
      onPopoverRender: function (popover) {
        var skip = document.createElement('button');
        skip.type = 'button';
        skip.textContent = 'Skip Tour';
        skip.style.cssText = 'border:none;background:transparent;color:#6B6F7E;margin-right:auto;padding-left:0';
        skip.addEventListener('click', function () { d.destroy(); });
        popover.footer.insertBefore(skip, popover.footer.firstChild);
      },
      onDestroyed: function () { S.set(cfg.storageKey, true); }
    });
    if (total) d.drive();
  }

  function start(cfg, makeDriver) {
    if (!cfg.welcome) return runSteps(cfg, makeDriver);
    var proceed = false;
    var w = makeDriver({
      popoverClass: 'asked-pop',
      overlayOpacity: 0.65,
      allowClose: true,
      steps: [{ popover: { title: cfg.welcome.title, description: cfg.welcome.body, showButtons: ['next', 'close'], doneBtnText: cfg.welcome.start, align: 'center' } }],
      onNextClick: function () { proceed = true; w.destroy(); },
      onPopoverRender: function (popover) {
        var skip = document.createElement('button');
        skip.type = 'button';
        skip.textContent = cfg.welcome.skip;
        skip.style.cssText = 'margin-right:auto';
        skip.addEventListener('click', function () { w.destroy(); });
        popover.footer.insertBefore(skip, popover.footer.firstChild);
      },
      onDestroyed: function () {
        S.set(cfg.storageKey, true);
        if (proceed) setTimeout(function () { runSteps(cfg, makeDriver); }, 150);
      }
    });
    w.drive();
  }

  var base = window.AskedBase || '';
  fetch(base + 'tour/tours.json').then(function (r) { return r.json(); }).then(function (all) {
    var cfg = all[which];
    if (!cfg) return;
    withDriver(function (makeDriver) {
      document.querySelectorAll('[data-replay-tour="' + which + '"]').forEach(function (a) {
        a.addEventListener('click', function (e) { e.preventDefault(); start(cfg, makeDriver); });
      });
      if (S.get(cfg.storageKey, false)) return;
      function go() { setTimeout(function () { start(cfg, makeDriver); }, cfg.delayMs || 800); }
      if (which === 'results') {
        if (!document.getElementById('results').hidden) go();
        else document.addEventListener('asked:results-ready', go, { once: true });
      } else go();
    });
  }).catch(function () { /* the tour is optional */ });
})();
