/* ==========================================================================
   MAISON — application layer
   i18n + RTL mirroring · instant curtain navigation · reveals · micro-interactions
   Presentation only. No data layer, no persistence beyond the language choice.
   ========================================================================== */
(function () {
  'use strict';

  var I18N   = window.MAISON_I18N;
  var SCENE  = window.MAISON_SCENE;
  var flags  = SCENE.flags;
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ======================================================================
     1 · i18n + direction
     ====================================================================== */
  var LANG_KEY = 'maison.lang';
  var current = 'en';

  function detect() {
    try {
      var saved = localStorage.getItem(LANG_KEY);
      if (saved && I18N.meta[saved]) return saved;
    } catch (e) {}
    var n = (navigator.language || 'en').toLowerCase();
    if (n.indexOf('ckb') === 0 || n.indexOf('ku') === 0) return 'ku';
    if (n.indexOf('ar') === 0) return 'ar';
    return 'en';
  }

  function t(key) {
    var row = I18N.strings[key];
    return row ? (row[current] || row.en) : '';
  }

  function setLang(code, animate) {
    if (!I18N.meta[code]) code = 'en';
    current = code;
    var meta = I18N.meta[code];

    var html = document.documentElement;
    html.setAttribute('lang', code);
    html.setAttribute('dir', meta.dir);
    html.setAttribute('data-font', meta.font);

    // text nodes
    $$('[data-i18n]').forEach(function (el) {
      var v = t(el.getAttribute('data-i18n'));
      if (v) el.textContent = v;
    });

    // attributes, e.g. data-i18n-attr="content:doc.desc"
    $$('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(',').forEach(function (pair) {
        var bits = pair.split(':');
        var v = t(bits[1]);
        if (v) el.setAttribute(bits[0].trim(), v);
      });
    });

    document.title = t('doc.title');

    // switcher state
    var short = meta.short;
    var cur = $('#langCur');
    if (cur) cur.textContent = short;
    $$('[data-lang]').forEach(function (b) {
      b.setAttribute('aria-current', b.getAttribute('data-lang') === code ? 'true' : 'false');
    });

    try { localStorage.setItem(LANG_KEY, code); } catch (e) {}

    // headings must be re-split against the new text
    resplit();
    if (animate) flashLang();
  }

  function flashLang() {
    var c = $('#curtain');
    if (!c || flags.reduced) return;
    c.classList.add('is-in');
    setTimeout(function () {
      c.classList.remove('is-in');
      c.classList.add('is-out');
      setTimeout(function () { c.classList.remove('is-out'); }, 520);
    }, 300);
  }

  /* ======================================================================
     2 · split headings into masked words
     ====================================================================== */
  function splitEl(el) {
    if (!el.__raw) el.__raw = el.textContent;
    var words = el.__raw.split(/\s+/).filter(Boolean);
    el.textContent = '';
    words.forEach(function (w, i) {
      var s = document.createElement('span');
      s.className = 'word';
      var inner = document.createElement('i');
      inner.textContent = w;
      inner.style.transitionDelay = (i * 0.045) + 's';
      s.appendChild(inner);
      el.appendChild(s);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  }

  function resplit() {
    $$('[data-split]').forEach(function (el) {
      // keep the translated string as the new source
      if (el.__lang !== current) { el.__raw = null; el.__lang = current; }
      if (!el.__raw) {
        var key = el.getAttribute('data-i18n');
        el.__raw = key ? t(key) : el.textContent;
      }
      splitEl(el);
    });
  }

  /* ======================================================================
     3 · reveals
     ====================================================================== */
  function initReveals() {
    var items = $$('[data-reveal], [data-split]');
    if (!('IntersectionObserver' in window) || flags.reduced) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ======================================================================
     4 · instant curtain navigation
     ====================================================================== */
  function jumpTo(hash) {
    if (hash === '#top') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      if (history.replaceState) history.replaceState(null, '', location.pathname);
      return;
    }
    var target = $(hash);
    if (!target) return;
    // scroll-margin-block-start on the section clears the condensed nav
    target.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'auto' });
    if (history.replaceState) history.replaceState(null, '', hash);
  }

  function initNavLinks() {
    var curtain = $('#curtain');

    document.addEventListener('click', function (ev) {
      var a = ev.target.closest ? ev.target.closest('[data-nav]') : null;
      if (!a) return;
      var hash = a.getAttribute('href');
      if (!hash || hash.charAt(0) !== '#') return;
      ev.preventDefault();

      closeMenu();

      if (flags.reduced || !curtain) { jumpTo(hash); return; }

      curtain.classList.remove('is-out');
      curtain.classList.add('is-in');
      setTimeout(function () {
        jumpTo(hash);                       // instant — nothing is fetched
        curtain.classList.remove('is-in');
        curtain.classList.add('is-out');
        setTimeout(function () { curtain.classList.remove('is-out'); }, 520);
      }, 420);
    });

    // placeholder links
    document.addEventListener('click', function (ev) {
      var a = ev.target.closest ? ev.target.closest('[data-soon]') : null;
      if (!a) return;
      ev.preventDefault();
      toast(t('ui.soon'));
    });
  }

  var toastTimer;
  function toast(msg) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-on'); }, 2600);
  }

  /* ======================================================================
     5 · nav chrome (stuck / hide / dark)
     ====================================================================== */
  var darkSections = [];
  function initNavChrome() {
    darkSections = ['#signature', '#texture', '#proof', '#final']
      .map(function (s) { return $(s); }).filter(Boolean);
  }

  function updateNav(y, dir) {
    var nav = $('#nav');
    if (!nav) return;
    nav.classList.toggle('is-stuck', y > 40);

    var menuOpen = $('#mmenu') && $('#mmenu').classList.contains('is-open');
    nav.classList.toggle('is-hidden', dir > 0 && y > 640 && !menuOpen);

    // hero occupies the nav band? its far half is red, so light the controls
    var hero = document.getElementById('hero');
    nav.classList.toggle('is-hero',
      !!hero && y < hero.offsetHeight - nav.offsetHeight && window.innerWidth > 1024);

    var h = nav.offsetHeight * 0.6, dark = false;
    for (var i = 0; i < darkSections.length; i++) {
      var r = darkSections[i].getBoundingClientRect();
      if (r.top <= h && r.bottom >= h) { dark = true; break; }
    }
    nav.classList.toggle('is-dark', dark);
  }

  /* ======================================================================
     6 · mobile menu + language menu
     ====================================================================== */
  function closeMenu() {
    var m = $('#mmenu'), b = $('#burger');
    if (!m || !m.classList.contains('is-open')) return;
    m.classList.remove('is-open');
    m.setAttribute('aria-hidden', 'true');
    if (b) b.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('is-locked');
  }

  function initMenus() {
    var burger = $('#burger'), m = $('#mmenu');
    if (burger && m) {
      burger.addEventListener('click', function () {
        var open = m.classList.toggle('is-open');
        m.setAttribute('aria-hidden', open ? 'false' : 'true');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
        document.body.classList.toggle('is-locked', open);
      });
    }

    var lang = $('#lang'), btn = $('#langBtn');
    if (lang && btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = lang.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.addEventListener('click', function () {
        lang.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
      });
    }

    document.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-lang]') : null;
      if (!b) return;
      ev.preventDefault();
      closeMenu();
      setLang(b.getAttribute('data-lang'), true);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeMenu(); if (lang) lang.classList.remove('is-open'); }
    });
  }

  /* ======================================================================
     7 · micro-interactions
     ====================================================================== */
  function initMagnetic() {
    if (flags.coarse || flags.reduced) return;
    $$('[data-magnetic]').forEach(function (el) {
      var raf, tx = 0, ty = 0, cx = 0, cy = 0;
      function loop() {
        cx += (tx - cx) * 0.16; cy += (ty - cy) * 0.16;
        el.style.transform = 'translate(' + cx.toFixed(2) + 'px,' + cy.toFixed(2) + 'px)';
        if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) raf = requestAnimationFrame(loop);
        else { el.style.transform = 'translate(' + tx + 'px,' + ty + 'px)'; raf = null; }
      }
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        tx = (e.clientX - (r.left + r.width / 2)) * 0.22;
        ty = (e.clientY - (r.top + r.height / 2)) * 0.3;
        if (!raf) raf = requestAnimationFrame(loop);
      });
      el.addEventListener('mouseleave', function () {
        tx = 0; ty = 0;
        if (!raf) raf = requestAnimationFrame(loop);
      });
    });
  }

  function initTilt() {
    if (flags.coarse || flags.reduced) return;
    $$('[data-tilt]').forEach(function (el) {
      el.style.transformStyle = 'preserve-3d';
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = 'perspective(900px) rotateY(' + (px * 4.5).toFixed(2) +
                             'deg) rotateX(' + (-py * 4.5).toFixed(2) + 'deg)';
        el.style.transition = 'transform .12s linear';
      });
      el.addEventListener('mouseleave', function () {
        el.style.transition = 'transform .9s cubic-bezier(.22,1,.36,1)';
        el.style.transform = '';
      });
    });
  }

  function initDragRail() {
    var rail = $('#editRail');
    if (!rail || flags.coarse) return;
    var down = false, startX = 0, startL = 0, moved = 0;

    rail.addEventListener('mousedown', function (e) {
      down = true; moved = 0;
      startX = e.pageX; startL = rail.scrollLeft;
      rail.classList.add('is-dragging');
    });
    addEventListener('mouseup', function () {
      down = false; rail.classList.remove('is-dragging');
    });
    addEventListener('mousemove', function (e) {
      if (!down) return;
      e.preventDefault();
      var d = e.pageX - startX;
      moved = Math.abs(d);
      rail.scrollLeft = startL - d;
    });
    rail.addEventListener('click', function (e) {
      if (moved > 6) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  }

  /* ======================================================================
     8 · scroll loop — scrubbers, parallax, nav
     ====================================================================== */
  var scrubbers = [];
  var parallax  = [];
  var lastY = 0, ticking = false;

  function initScenes() {
    var hero = $('#hero'), heroV = $('#heroVideo');
    if (hero && heroV) {
      scrubbers.push(new SCENE.VideoScrubber({
        el: heroV,
        base: 'flacon|flacon-sq',
        range: function () { return { start: 0, end: hero.offsetHeight }; },
        onFrame: function () {
          var still = $('#heroStill');
          if (still && heroV.classList.contains('is-ready')) still.classList.add('is-hidden');
        }
      }));
    }

    var sig = $('#signature'), sigV = $('#sigVideo'), bar = $('#sigBar');
    if (sig && sigV) {
      scrubbers.push(new SCENE.VideoScrubber({
        el: sigV,
        base: 'khair',
        range: function () {
          var top = sig.offsetTop;
          return { start: top, end: top + sig.offsetHeight - window.innerHeight };
        },
        onFrame: function (p) { if (bar) bar.style.transform = 'scaleX(' + p.toFixed(3) + ')'; }
      }));
    }

    // final section: ambient loop, not scrubbed
    var fin = $('#final'), finV = $('#finVideo');
    if (fin && finV && !flags.reduced && !(navigator.connection && navigator.connection.saveData)) {
      var io = new IntersectionObserver(function (e) {
        if (e[0].isIntersecting) {
          if (!finV.src) {
            var fs = SCENE.pick('skincare', flags.small);
            if (!fs) return;                   // poster carries the section
            finV.src = fs;
            finV.loop = true;
          }
          var pr = finV.play(); if (pr && pr.catch) pr.catch(function () {});
        } else { finV.pause(); }
      }, { rootMargin: '50% 0px' });
      io.observe(fin);
    }

    parallax = [
      { el: $('#texImg'),  host: $('#texture'),    amt: 0.10 },
      { el: $('#philImg'), host: $('#philosophy'), amt: 0.07 }
    ].filter(function (p) { return p.el && p.host; });

    new SCENE.Atmos($('#atmos'));
  }

  function onScroll() {
    var y = window.scrollY;
    var dir = y > lastY ? 1 : -1;
    lastY = y;

    updateNav(y, dir);
    for (var i = 0; i < scrubbers.length; i++) scrubbers[i].update();

    if (!flags.reduced) {
      for (var j = 0; j < parallax.length; j++) {
        var p = parallax[j];
        var r = p.host.getBoundingClientRect();
        if (r.bottom < -200 || r.top > window.innerHeight + 200) continue;
        var mid = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
        p.el.style.transform = 'translate3d(0,' + (-mid * p.amt * 100).toFixed(2) + 'px,0)';
      }
    }
    ticking = false;
  }

  function queue() { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }

  /* smooth the scrubbers even when the wheel stops */
  function idleLoop() {
    for (var i = 0; i < scrubbers.length; i++) scrubbers[i].update();
    requestAnimationFrame(idleLoop);
  }

  /* ======================================================================
     9 · boot
     ====================================================================== */
  function boot() {
    var yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();

    setLang(detect(), false);
    initNavChrome();
    initNavLinks();
    initMenus();
    initReveals();
    initMagnetic();
    initTilt();
    initDragRail();
    initScenes();

    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', function () { queue(); }, { passive: true });
    onScroll();
    if (!flags.reduced) requestAnimationFrame(idleLoop);

    // if the page opened on a hash, land there without the curtain
    if (location.hash && $(location.hash)) {
      setTimeout(function () { jumpTo(location.hash); }, 60);
    }

    // loader out — short, never blocking
    var loader = $('#loader');
    function dismiss() {
      if (!loader) return;
      loader.classList.add('is-done');
      setTimeout(function () { loader.remove(); }, 800);
    }
    if (flags.reduced) { dismiss(); }
    else {
      var t0 = Date.now();
      var go = function () { setTimeout(dismiss, Math.max(0, 1450 - (Date.now() - t0))); };
      if (document.readyState === 'complete') go();
      else addEventListener('load', go);
      setTimeout(dismiss, 3200);            // hard ceiling
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
