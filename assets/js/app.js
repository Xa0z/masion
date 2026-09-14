/* ==========================================================================
   MAISON — application layer
   Instant hash router · trilingual + RTL · journey scrubbing · view rendering
   ========================================================================== */
(function () {
  'use strict';

  var I18N  = window.MAISON_I18N;
  var SCENE = window.MAISON_SCENE;
  var STORE = window.MAISON_STORE;
  var CAT   = window.MAISON_CATALOGUE;
  var flags = SCENE.flags;

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ======================================================================
     1 · i18n
     ====================================================================== */
  var LANG_KEY = 'maison.lang';
  var current = 'en';

  function detect() {
    try { var s = localStorage.getItem(LANG_KEY); if (s && I18N.meta[s]) return s; } catch (e) {}
    var n = (navigator.language || 'en').toLowerCase();
    if (n.indexOf('ckb') === 0 || n.indexOf('ku') === 0) return 'ku';
    if (n.indexOf('ar') === 0) return 'ar';
    return 'en';
  }

  function t(key) {
    var row = I18N.strings[key];
    return row ? (row[current] || row.en) : '';
  }

  function fmtPrice(n) {
    return STORE.money(n) + ' ' + t('ui.currency');
  }

  function applyStrings(root) {
    $$('[data-i18n]', root).forEach(function (el) {
      var v = t(el.getAttribute('data-i18n'));
      if (v) el.textContent = v;
    });
    $$('[data-i18n-attr]', root).forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(',').forEach(function (pair) {
        var bits = pair.split(':');
        var v = t(bits[1]);
        if (v) el.setAttribute(bits[0].trim(), v);
      });
    });
  }

  function setLang(code, animate) {
    if (!I18N.meta[code]) code = 'en';
    current = code;
    var meta = I18N.meta[code];
    var html = document.documentElement;
    html.setAttribute('lang', code);
    html.setAttribute('dir', meta.dir);
    html.setAttribute('data-font', meta.font);

    applyStrings(document);
    document.title = t('doc.title');

    var cur = $('#langCur'); if (cur) cur.textContent = meta.short;
    $$('[data-lang]').forEach(function (b) {
      b.setAttribute('aria-current', b.getAttribute('data-lang') === code ? 'true' : 'false');
    });

    try { localStorage.setItem(LANG_KEY, code); } catch (e) {}

    resplit();
    render();                               // prices, product copy, forms
    if (window.MAISON_ADVISOR) window.MAISON_ADVISOR.relabel();
    if (animate) flashCurtain(300);
  }

  /* ======================================================================
     2 · split headings
     ====================================================================== */
  function splitEl(el) {
    var words = (el.__raw || '').split(/\s+/).filter(Boolean);
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
      var key = el.getAttribute('data-i18n');
      el.__raw = key ? t(key) : (el.__raw || el.textContent);
      splitEl(el);
    });
  }

  /* ======================================================================
     3 · reveals
     ====================================================================== */
  var revealIO = null;
  function observeReveals(root) {
    var items = $$('[data-reveal], [data-split]', root || document);
    if (!('IntersectionObserver' in window) || flags.reduced) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    if (!revealIO) {
      revealIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-in');
          revealIO.unobserve(e.target);
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
    }
    items.forEach(function (el) { if (!el.classList.contains('is-in')) revealIO.observe(el); });
  }

  /* ======================================================================
     4 · router — instant, nothing is fetched
     ====================================================================== */
  var VIEWS = ['home', 'shop', 'product', 'cart', 'checkout'];
  var route = { view: 'home', param: '', anchor: '' };
  var mounted = false;

  function parseHash(h) {
    h = (h || location.hash || '#/').replace(/^#/, '');
    var anchor = '';
    var hi = h.indexOf('#');
    if (hi >= 0) { anchor = h.slice(hi + 1); h = h.slice(0, hi); }
    var parts = h.split('/').filter(Boolean);
    var view = parts[0] || 'home';
    var param = parts[1] || '';
    if (view === 'p') { view = 'product'; }
    if (VIEWS.indexOf(view) < 0) { view = 'home'; param = ''; }
    return { view: view, param: param, anchor: anchor };
  }

  function mount(r, keepScroll) {
    route = r;
    document.body.setAttribute('data-view', r.view);

    $$('.view').forEach(function (v) {
      v.classList.toggle('is-on', v.getAttribute('data-viewname') === r.view);
    });

    $$('.nav__links a[data-route]').forEach(function (a) {
      a.classList.toggle('is-active', a.getAttribute('data-route') === r.view);
    });

    render();

    if (!keepScroll) {
      if (r.anchor && $('#' + r.anchor)) {
        $('#' + r.anchor).scrollIntoView({ block: 'start', behavior: 'auto' });
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }
    }
    observeReveals();
    updateJourneyRange();
    onScroll();
    if (mounted) { focusView(); announceView(); }
    mounted = true;
  }

  function navigate(hash, instant) {
    var r = parseHash(hash);
    var same = r.view === route.view && r.param === route.param;
    if (history.replaceState) history.replaceState(null, '', hash);
    else location.hash = hash;

    if (same && r.anchor) {                       // in-page jump only
      var target = $('#' + r.anchor);
      if (target) target.scrollIntoView({ block: 'start', behavior: 'auto' });
      return;
    }
    if (instant || flags.reduced) { mount(r); return; }

    var c = $('#curtain');
    if (!c) { mount(r); return; }
    c.classList.remove('is-out');
    c.classList.add('is-in');
    setTimeout(function () {
      mount(r);
      c.classList.remove('is-in');
      c.classList.add('is-out');
      setTimeout(function () { c.classList.remove('is-out'); }, 520);
    }, 420);
  }

  function flashCurtain(delay) {
    var c = $('#curtain');
    if (!c || flags.reduced) return;
    c.classList.add('is-in');
    setTimeout(function () {
      c.classList.remove('is-in');
      c.classList.add('is-out');
      setTimeout(function () { c.classList.remove('is-out'); }, 520);
    }, delay || 300);
  }

  /* ----------------------------------------------------------------------
     focus — a client-side view change must behave like a page change:
     move focus to the new view so screen readers and the keyboard follow.
     ---------------------------------------------------------------------- */
  /* Name the view that just mounted, for anyone not watching the screen. */
  function announceView() {
    var el = $('#announcer'); if (!el) return;
    var h = $('.view.is-on h1') || $('.view.is-on .hero__title');
    el.textContent = h ? h.textContent.trim() : '';
  }

  function focusView() {
    var main = $('#main');
    if (!main) return;
    var h = $('.view.is-on h1') || $('.view.is-on .hero__title');
    var target = h || main;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
  }

  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
                  'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function trapFocus(container) {
    function onKey(e) {
      if (e.key !== 'Tab') return;
      var items = $$(FOCUSABLE, container).filter(function (el) {
        return el.offsetWidth || el.offsetHeight || el.getClientRects().length;
      });
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    container.addEventListener('keydown', onKey);
    return function () { container.removeEventListener('keydown', onKey); };
  }

  /* ======================================================================
     5 · rendering
     ====================================================================== */
  var shopFilter = 'all';
  var shopSort = 'featured';

  function pImg(p, w) { return 'assets/img/' + p.img + '-' + w + '.jpg'; }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function cardHTML(p) {
    return '' +
      '<article class="card">' +
        '<a class="card__media" href="#/p/' + p.id + '" data-nav data-tilt tabindex="-1" aria-hidden="true">' +
          '<img src="' + pImg(p, 720) + '" srcset="' + pImg(p, 720) + ' 720w, ' + pImg(p, 1200) + ' 1200w" ' +
               'sizes="(max-width:600px) 88vw, (max-width:1024px) 44vw, 23vw" alt="" loading="lazy" decoding="async">' +
          '<span class="card__house">' + t(p.house === 'perfumes' ? 'brand.perfumes' : 'brand.cosmetic') + '</span>' +
        '</a>' +
        '<div class="card__body">' +
          '<a class="card__name" href="#/p/' + p.id + '" data-nav>' + t('p.' + p.id + '.name') + '</a>' +
          '<span class="card__kind">' + t('p.' + p.id + '.kind') + '</span>' +
          '<div class="card__foot">' +
            '<span class="price">' + STORE.money(p.price) + '<small>' + t('ui.currency') + '</small></span>' +
            '<button class="card__add" data-add="' + p.id + '">' + t('pdp.add') + '</button>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function renderEdit() {
    var grid = $('#editGrid'); if (!grid) return;
    var feat = CAT.products.filter(function (p) { return p.feature; }).slice(0, 4);
    grid.innerHTML = feat.map(cardHTML).join('');
  }

  function renderShop() {
    var grid = $('#shopGrid'); if (!grid) return;

    var fil = $('#filters');
    if (fil) {
      fil.innerHTML = CAT.categories.map(function (c) {
        return '<button data-cat="' + c.id + '" aria-pressed="' + (c.id === shopFilter) + '">' + t(c.key) + '</button>';
      }).join('');
    }
    var sel = $('#sortSel');
    if (sel) { applyStrings(sel); sel.value = shopSort; }

    var list = CAT.products.filter(function (p) {
      return shopFilter === 'all' || p.cat === shopFilter;
    });
    if (shopSort === 'low')  list.sort(function (a, b) { return a.price - b.price; });
    if (shopSort === 'high') list.sort(function (a, b) { return b.price - a.price; });

    grid.innerHTML = list.map(cardHTML).join('');
    var empty = $('#shopEmpty');
    if (empty) empty.hidden = list.length > 0;
  }

  function renderProduct() {
    var host = $('#pdp'); if (!host) return;
    var p = STORE.byId(route.param);
    if (!p) {
      host.innerHTML = '<div class="view__head"><h1 class="view__title display">' + t('shop.empty') + '</h1>' +
        '<p><a class="btn btn--ghost" href="#/shop" data-nav>' + t('pdp.back') + '</a></p></div>';
      return;
    }

    var spin = SCENE.spinFor(p.id);
    var wide = p.ratio === '16/9';

    host.innerHTML = '' +
      '<div class="view__head"><a class="pdp__back" href="#/shop" data-nav>← ' + t('pdp.back') + '</a></div>' +
      '<div class="pdp">' +
        '<div class="pdp__media' + (wide ? ' pdp__media--wide' : '') + '" id="pdpMedia"' +
             (spin ? ' aria-label="' + esc(t('ui.spinHelp')) + '"' : '') + '>' +
          (spin ? '<video class="pdp__video" id="pdpVideo" muted playsinline preload="none" disablepictureinpicture poster="' + spin.poster + '"></video>' : '') +
          '<img class="pdp__still" src="' + pImg(p, 1200) + '" srcset="' + pImg(p, 720) + ' 720w, ' + pImg(p, 1200) + ' 1200w" ' +
              'sizes="(max-width:1024px) 92vw, 48vw" alt="" decoding="async">' +
          (spin ? '<span class="pdp__spin"><span class="pdp__ring" id="spinRing"></span><b>360°</b><i>' + t('pdp.drag') + '</i></span>' : '') +
        '</div>' +
        '<div>' +
          '<p class="pdp__house">' + t(p.house === 'perfumes' ? 'brand.perfumes' : 'brand.cosmetic') + '</p>' +
          '<h1 class="pdp__name">' + t('p.' + p.id + '.name') + '</h1>' +
          '<p class="pdp__kind">' + t('p.' + p.id + '.kind') + '</p>' +
          '<p class="pdp__price">' + fmtPrice(p.price) + '</p>' +
          '<p class="pdp__desc">' + t('p.' + p.id + '.desc') + '</p>' +
          '<dl class="pdp__spec">' +
            '<div><dt>' + t('pdp.size') + '</dt><dd>' + p.size + '</dd></div>' +
            '<div><dt>' + t('pdp.notes') + '</dt><dd>' + p.notes.map(t).join(' · ') + '</dd></div>' +
          '</dl>' +
          '<div class="pdp__buy">' +
            '<div class="qty">' +
              '<button data-q="-" aria-label="−">−</button><span id="pdpQty">1</span><button data-q="+" aria-label="+">+</button>' +
            '</div>' +
            '<button class="btn btn--gold" id="pdpAdd" data-magnetic><span>' + t('pdp.add') + '</span></button>' +
          '</div>' +
          '<p class="pdp__ship">' + t('pdp.delivery') + '</p>' +
        '</div>' +
      '</div>' +
      '<section class="sec"><header class="secHead"><h2 class="secHead__title display">' + t('pdp.related') + '</h2></header>' +
      '<div class="pgrid pgrid--3">' +
        CAT.products.filter(function (o) { return o.cat === p.cat && o.id !== p.id; })
                    .slice(0, 3).map(cardHTML).join('') +
      '</div></section>';

    if (spin) {
      var media = $('#pdpMedia');
      var ring = $('#spinRing');
      SCENE.mountSpin(media, $('#pdpVideo'), spin, function (pr) {
        if (ring) ring.style.setProperty('--p', (pr * 100).toFixed(1) + '%');
      });
    }
  }

  function renderCart() {
    var host = $('#cartBody'); if (!host) return;
    var ls = STORE.lines();

    if (!ls.length) {
      host.innerHTML = '<div class="cart__empty"><p>' + t('cart.empty') + '</p>' +
        '<a class="btn" href="#/shop" data-nav data-magnetic><span>' + t('cart.emptyCta') + '</span></a></div>';
      return;
    }

    host.innerHTML = '' +
      '<div class="cart">' +
        '<div class="cart__list">' +
          ls.map(function (l) {
            return '<div class="cart__row">' +
              '<a class="cart__thumb" href="#/p/' + l.id + '" data-nav aria-label="' + esc(t('p.' + l.id + '.name')) + '">' +
                '<img src="' + pImg(l.product, 720) + '" alt="" loading="lazy"></a>' +
              '<div>' +
                '<a class="cart__name" href="#/p/' + l.id + '" data-nav>' + t('p.' + l.id + '.name') + '</a>' +
                '<div class="cart__kind">' + t('p.' + l.id + '.kind') + ' · ' + l.product.size + '</div>' +
                '<div class="cart__ctrls">' +
                  '<div class="qty"><button data-cq="-" data-id="' + l.id + '">−</button>' +
                  '<span>' + l.qty + '</span>' +
                  '<button data-cq="+" data-id="' + l.id + '">+</button></div>' +
                  '<button class="cart__remove" data-rm="' + l.id + '">' + t('cart.remove') + '</button>' +
                '</div>' +
              '</div>' +
              '<div class="cart__line">' + fmtPrice(l.line) + '</div>' +
            '</div>';
          }).join('') +
        '</div>' +
        '<aside class="summary">' +
          '<h2>' + t('co.summary') + '</h2>' +
          '<div class="summary__row"><span>' + t('cart.subtotal') + '</span><span>' + fmtPrice(STORE.subtotal()) + '</span></div>' +
          '<div class="summary__row summary__row--total"><span>' + t('cart.total') + '</span><span>' + fmtPrice(STORE.subtotal()) + '</span></div>' +
          '<a class="btn btn--full" href="#/checkout" data-nav data-magnetic><span>' + t('cart.checkout') + '</span></a>' +
          '<a class="btn btn--ghost btn--full" href="#/shop" data-nav style="margin-block-start:.75rem"><span>' + t('cart.continue') + '</span></a>' +
          '<p class="summary__note">' + t('pdp.delivery') + '</p>' +
        '</aside>' +
      '</div>';
  }

  var co = { city: 'erbil', done: null };

  function renderCheckout() {
    var host = $('#coBody'); if (!host) return;

    if (co.done) { renderDone(host); return; }

    var ls = STORE.lines();
    if (!ls.length) {
      host.innerHTML = '<div class="cart__empty"><p>' + t('cart.empty') + '</p>' +
        '<a class="btn" href="#/shop" data-nav data-magnetic><span>' + t('cart.emptyCta') + '</span></a></div>';
      return;
    }

    var fee = STORE.deliveryFee(co.city);
    var tot = STORE.total(co.city);

    host.innerHTML = '' +
      '<form class="co" id="coForm" novalidate>' +
        '<div>' +
          '<div class="co__group">' +
            '<h2>' + t('co.details') + '</h2>' +
            '<div class="co__fields">' +
              '<div class="co__field co__field--wide"><label for="fName">' + t('co.name') + '</label>' +
                '<input class="field" id="fName" name="name" autocomplete="name"><span class="co__err"></span></div>' +
              '<div class="co__field"><label for="fPhone">' + t('co.phone') + '</label>' +
                '<input class="field" id="fPhone" name="phone" inputmode="tel" autocomplete="tel" dir="ltr"><span class="co__err"></span></div>' +
              '<div class="co__field"><label for="fCity">' + t('co.city') + '</label>' +
                '<select class="field" id="fCity" name="city">' +
                  CAT.delivery.map(function (c) {
                    return '<option value="' + c.id + '"' + (c.id === co.city ? ' selected' : '') + '>' + t(c.key) + '</option>';
                  }).join('') +
                '</select><span class="co__err"></span></div>' +
              '<div class="co__field co__field--wide"><label for="fAddr">' + t('co.address') + '</label>' +
                '<input class="field" id="fAddr" name="address" autocomplete="street-address" ' +
                  'placeholder="' + t('co.addressHint') + '"><span class="co__err"></span></div>' +
              '<div class="co__field co__field--wide"><label for="fNote">' + t('co.note') + '</label>' +
                '<textarea class="field" id="fNote" name="note"></textarea></div>' +
            '</div>' +
          '</div>' +
          '<div class="co__group">' +
            '<h2>' + t('co.payment') + '</h2>' +
            '<div class="pay"><div class="pay__opt">' +
              '<span class="pay__mark"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
              '<span><strong>' + t('co.cod') + '</strong><p>' + t('co.codNote') + '</p></span>' +
            '</div></div>' +
          '</div>' +
        '</div>' +
        '<aside class="summary">' +
          '<h2>' + t('co.summary') + '</h2>' +
          ls.map(function (l) {
            return '<div class="summary__row"><span>' + t('p.' + l.id + '.name') + ' × ' + l.qty + '</span><span>' + fmtPrice(l.line) + '</span></div>';
          }).join('') +
          '<div class="summary__row"><span>' + t('cart.subtotal') + '</span><span>' + fmtPrice(STORE.subtotal()) + '</span></div>' +
          '<div class="summary__row"><span>' + t('co.deliveryFee') + '</span><span>' + (fee ? fmtPrice(fee) : t('co.free')) + '</span></div>' +
          '<div class="summary__row summary__row--total"><span>' + t('cart.total') + '</span><span>' + fmtPrice(tot) + '</span></div>' +
          '<button class="btn btn--gold btn--full" type="submit" id="coSubmit"><span>' + t('co.place') + '</span></button>' +
          '<p class="summary__note">' + t('co.demo') + '</p>' +
        '</aside>' +
      '</form>';
  }

  function renderDone(host) {
    var d = co.done;
    host.innerHTML = '' +
      '<div class="done">' +
        '<div class="done__mark"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
        '<h2>' + t('co.done') + '</h2>' +
        '<p>' + t('co.doneBody') + '</p>' +
        '<p class="done__ref">' + t('co.orderNo') + ' · ' + d.ref + '</p>' +
        '<div class="done__acts">' +
          '<a class="btn btn--gold" href="' + d.wa + '" target="_blank" rel="noopener"><span>' + t('co.sendWhatsapp') + '</span></a>' +
          '<a class="btn" href="https://www.instagram.com/maison.cosmetic/" target="_blank" rel="noopener"><span>' + t('co.sendInstagram') + '</span></a>' +
          '<button class="btn btn--ghost" id="coCopy"><span>' + t('co.copy') + '</span></button>' +
        '</div>' +
        '<p class="summary__note" style="margin-block-start:2rem">' + t('co.demo') + '</p>' +
        '<p style="margin-block-start:1.5rem"><a class="pdp__back" href="#/shop" data-nav>' + t('co.backShop') + '</a></p>' +
      '</div>';
  }

  function render() {
    // The grids are cheap to rebuild and live in views that may be hidden,
    // so refresh them unconditionally — otherwise a language switch leaves
    // stale copy behind in whichever view is not on screen.
    renderEdit();
    renderShop();
    if (route.view === 'product')  { renderProduct(); }
    if (route.view === 'cart')     { renderCart(); }
    if (route.view === 'checkout') { renderCheckout(); }
    syncBag();
    observeReveals();
  }

  /* ======================================================================
     6 · order handoff — the customer sends it; nothing is transmitted here
     ====================================================================== */
  function buildOrder(f) {
    var ls = STORE.lines();
    var city = STORE.cityById(f.city);
    var fee = STORE.deliveryFee(f.city);
    var ref = 'M' + Date.now().toString(36).slice(-5).toUpperCase();

    var txt = 'MAISON — ' + t('co.title') + ' · ' + ref + '\n\n' +
      ls.map(function (l) {
        return '• ' + t('p.' + l.id + '.name') + ' (' + l.product.size + ') × ' + l.qty + ' — ' + fmtPrice(l.line);
      }).join('\n') +
      '\n\n' + t('cart.subtotal') + ': ' + fmtPrice(STORE.subtotal()) +
      '\n' + t('co.deliveryFee') + ': ' + (fee ? fmtPrice(fee) : t('co.free')) +
      '\n' + t('cart.total') + ': ' + fmtPrice(STORE.total(f.city)) +
      '\n\n' + t('co.name') + ': ' + f.name +
      '\n' + t('co.phone') + ': ' + f.phone +
      '\n' + t('co.city') + ': ' + t(city.key) +
      '\n' + t('co.address') + ': ' + f.address +
      (f.note ? '\n' + t('co.note') + ': ' + f.note : '') +
      '\n' + t('co.payment') + ': ' + t('co.cod');

    return { ref: ref, text: txt, wa: 'https://wa.me/?text=' + encodeURIComponent(txt) };
  }

  /* ======================================================================
     7 · bag chrome
     ====================================================================== */
  function syncBag() {
    var n = STORE.count();
    var badge = $('#bagCount');
    if (!badge) return;
    badge.textContent = n;
    badge.classList.toggle('is-on', n > 0);
  }
  function bump() {
    var b = $('#bagBtn'); if (!b) return;
    b.classList.remove('is-bump');
    void b.offsetWidth;
    b.classList.add('is-bump');
  }

  /* ======================================================================
     8 · journey scrubbing
     ====================================================================== */
  var journey = null;
  var docRange = { start: 0, end: 1 };

  function updateJourneyRange() {
    var h = Math.max(1, document.body.scrollHeight - window.innerHeight);
    docRange = { start: 0, end: h };
  }

  var journeyReady = false;

  function initJourney() {
    var v = $('#bgVideo'); if (!v) return;
    journey = new SCENE.VideoScrubber({
      el: v,
      // "a|b" picks b on phones and a elsewhere, and unlike the plain form it
      // does not also append -sm — the tiers here are already explicit.
      // Everyone but phones is then quietly upgraded to the 1920 cut.
      base:   'journey-lo|journey-sm',
      hiBase: flags.phone ? null : 'journey',
      eager: true,
      fps: 24,                                   // the journey is cut at 24fps
      range: function () { return docRange; },
      onProgress: setLoadProgress,
      onReady: function () { journeyReady = true; releaseLoader(); },
      onFrame: function (p) {
        var c = $('#chapter');
        if (c && route.view === 'home') {
          var n = Math.min(4, Math.floor(p * 4) + 1);
          c.textContent = '0' + n + ' / 04';
        }
      }
    });
    // never let a stalled network hold the door shut
    setTimeout(function () { journeyReady = true; releaseLoader(); }, 6000);
  }

  /* ======================================================================
     8b · map — show a real card if the embed is blocked or unreachable
     ====================================================================== */
  function initMap() {
    var frame = $('#mapFrame'), fb = $('#mapFallback');
    if (!frame || !fb) return;
    var settled = false;
    function fail() { if (settled) return; settled = true; fb.hidden = false; }
    function ok()   { if (settled) return; settled = true; fb.hidden = true; }
    frame.addEventListener('load', ok);
    frame.addEventListener('error', fail);
    // a blocked cross-origin frame often fires neither event
    setTimeout(function () { if (!settled) fail(); }, 6000);
  }

  /* ======================================================================
     9 · micro-interactions
     ====================================================================== */
  function initMagnetic() {
    if (flags.coarse || flags.reduced) return;
    document.addEventListener('mousemove', function (e) {
      var el = e.target.closest ? e.target.closest('[data-magnetic]') : null;
      if (!el) return;
      var r = el.getBoundingClientRect();
      var tx = (e.clientX - (r.left + r.width / 2)) * 0.18;
      var ty = (e.clientY - (r.top + r.height / 2)) * 0.26;
      el.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px)';
      el.style.transition = 'transform .18s linear';
    });
    document.addEventListener('mouseout', function (e) {
      var el = e.target.closest ? e.target.closest('[data-magnetic]') : null;
      if (!el) return;
      el.style.transition = 'transform .8s cubic-bezier(.22,1,.36,1)';
      el.style.transform = '';
    });
  }

  /* ======================================================================
     10 · nav chrome
     ====================================================================== */
  var lastY = 0, ticking = false;

  var spySections = null;

  function updateSpy() {
    if (route.view !== 'home') {
      $$('.nav__links a[data-spy]').forEach(function (a) { a.classList.remove('is-active'); });
      return;
    }
    if (!spySections) {
      spySections = $$('.nav__links a[data-spy]').map(function (a) {
        return { link: a, el: $('#' + a.getAttribute('data-spy')) };
      }).filter(function (o) { return o.el; });
    }
    var line = window.innerHeight * 0.38, best = null;
    spySections.forEach(function (o) {
      var r = o.el.getBoundingClientRect();
      if (r.top <= line && r.bottom > line) best = o;
    });
    spySections.forEach(function (o) { o.link.classList.toggle('is-active', o === best); });
  }

  function updateNav(y, dir) {
    var nav = $('#nav'); if (!nav) return;
    nav.classList.toggle('is-stuck', y > 40);
    updateSpy();
    var menuOpen = $('#mmenu') && $('#mmenu').classList.contains('is-open');
    var advOpen = $('#advisor') && $('#advisor').classList.contains('is-open');
    nav.classList.toggle('is-hidden', dir > 0 && y > 640 && !menuOpen && !advOpen);
  }

  function onScroll() {
    var y = window.scrollY;
    var dir = y > lastY ? 1 : -1;
    lastY = y;
    updateNav(y, dir);
    if (journey) journey.update();
    ticking = false;
  }
  function queue() { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }
  function idleLoop() { if (journey) journey.update(); requestAnimationFrame(idleLoop); }

  /* ======================================================================
     11 · menus
     ====================================================================== */
  var menuRelease = null;

  function closeMenu(restore) {
    var m = $('#mmenu'), b = $('#burger');
    if (!m || !m.classList.contains('is-open')) return;
    m.classList.remove('is-open');
    m.setAttribute('aria-hidden', 'true');
    if (b) b.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('is-locked');
    if (menuRelease) { menuRelease(); menuRelease = null; }
    if (restore && b) b.focus();
  }

  function initMenus() {
    var burger = $('#burger'), m = $('#mmenu');
    if (burger && m) {
      burger.addEventListener('click', function () {
        var open = m.classList.toggle('is-open');
        m.setAttribute('aria-hidden', open ? 'false' : 'true');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
        document.body.classList.toggle('is-locked', open);
        if (open) {
          menuRelease = trapFocus(m);
          var first = $(FOCUSABLE, m);
          if (first) setTimeout(function () { first.focus(); }, 420);
        } else if (menuRelease) { menuRelease(); menuRelease = null; }
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
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeMenu(true); if (lang) lang.classList.remove('is-open'); }
    });
  }

  /* ======================================================================
     12 · global delegation
     ====================================================================== */
  var toastTimer;
  function toast(msg) {
    var el = $('#toast'); if (!el) return;
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-on'); }, 2400);
  }

  function initEvents() {
    document.addEventListener('click', function (ev) {
      var el = ev.target;

      var nav = el.closest && el.closest('[data-nav]');
      if (nav) {
        var href = nav.getAttribute('href') || '';
        if (href.charAt(0) === '#') {
          ev.preventDefault();
          closeMenu();
          navigate(href);
          return;
        }
      }

      var add = el.closest && el.closest('[data-add]');
      if (add) {
        ev.preventDefault();
        STORE.add(add.getAttribute('data-add'), 1);
        add.classList.add('is-done');
        add.textContent = t('pdp.added');
        bump();
        setTimeout(function () {
          add.classList.remove('is-done');
          add.textContent = t('pdp.add');
        }, 1400);
        return;
      }

      var cq = el.closest && el.closest('[data-cq]');
      if (cq) {
        ev.preventDefault();
        var id = cq.getAttribute('data-id');
        var cur = 0;
        STORE.lines().forEach(function (l) { if (l.id === id) cur = l.qty; });
        STORE.setQty(id, cq.getAttribute('data-cq') === '+' ? cur + 1 : cur - 1);
        render();
        return;
      }

      var rm = el.closest && el.closest('[data-rm]');
      if (rm) { ev.preventDefault(); STORE.remove(rm.getAttribute('data-rm')); render(); return; }

      var q = el.closest && el.closest('[data-q]');
      if (q) {
        ev.preventDefault();
        var box = $('#pdpQty'); if (!box) return;
        var n = Math.max(1, Math.min(99, (parseInt(box.textContent, 10) || 1) + (q.getAttribute('data-q') === '+' ? 1 : -1)));
        box.textContent = n;
        return;
      }

      if (el.closest && el.closest('#pdpAdd')) {
        ev.preventDefault();
        var qty = parseInt(($('#pdpQty') || {}).textContent, 10) || 1;
        STORE.add(route.param, qty);
        bump();
        toast(t('pdp.added'));
        return;
      }

      var cat = el.closest && el.closest('[data-cat]');
      if (cat) { shopFilter = cat.getAttribute('data-cat'); renderShop(); observeReveals(); return; }

      if (el.closest && el.closest('#coCopy')) {
        ev.preventDefault();
        var txt = co.done ? co.done.text : '';
        if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function(){ toast(t('co.copied')); },
                                                                     function(){ toast(txt); });
        return;
      }

      var langBtn = el.closest && el.closest('[data-lang]');
      if (langBtn) {
        ev.preventDefault();
        closeMenu();
        setLang(langBtn.getAttribute('data-lang'), true);
        return;
      }
    });

    document.addEventListener('change', function (ev) {
      if (ev.target.id === 'sortSel') { shopSort = ev.target.value; renderShop(); observeReveals(); }
      if (ev.target.id === 'fCity')   { co.city = ev.target.value; renderCheckout(); }
    });

    document.addEventListener('submit', function (ev) {
      if (ev.target.id !== 'coForm') return;
      ev.preventDefault();

      var f = {
        name: ($('#fName') || {}).value || '',
        phone: ($('#fPhone') || {}).value || '',
        city: ($('#fCity') || {}).value || 'erbil',
        address: ($('#fAddr') || {}).value || '',
        note: ($('#fNote') || {}).value || ''
      };

      var bad = false;
      [['fName', f.name.trim().length >= 2], ['fAddr', f.address.trim().length >= 4],
       ['fPhone', /^[+\d][\d\s\-()]{6,}$/.test(f.phone.trim())]].forEach(function (pair) {
        var field = $('#' + pair[0]);
        if (!field) return;
        var wrap = field.closest('.co__field');
        var err = wrap.querySelector('.co__err');
        if (pair[1]) { wrap.classList.remove('is-bad'); err.textContent = ''; }
        else {
          wrap.classList.add('is-bad');
          err.textContent = pair[0] === 'fPhone' ? t('co.phoneBad') : t('co.required');
          if (!bad) field.focus();
          bad = true;
        }
      });
      if (bad) return;

      co.done = buildOrder(f);
      STORE.clear();
      renderCheckout();
      syncBag();
      window.scrollTo({ top: 0, behavior: 'auto' });
    });

    window.addEventListener('hashchange', function () {
      var r = parseHash();
      if (r.view !== route.view || r.param !== route.param) mount(r);
    });
  }

  /* ======================================================================
     12b · loading — the bar tracks the real prefetch, and the hero is not
     revealed until the film is actually able to scrub
     ====================================================================== */
  var pageLoaded = false, bootAt = 0, loaderGone = false;

  function setLoadProgress(p) {
    var bar = $('#loaderBar');
    if (bar) bar.style.transform = 'scaleX(' + Math.max(0.04, p).toFixed(3) + ')';
  }

  function releaseLoader() {
    if (loaderGone) return;
    if (!journeyReady || !pageLoaded) return;
    loaderGone = true;
    setLoadProgress(1);
    var loader = $('#loader');
    if (!loader) return;
    // let the filled bar register before the curtain lifts
    var wait = Math.max(0, 900 - (Date.now() - bootAt));
    setTimeout(function () {
      loader.classList.add('is-done');
      setTimeout(function () { if (loader.parentNode) loader.remove(); }, 800);
    }, wait);
  }

  /* ======================================================================
     13 · boot
     ====================================================================== */
  function boot() {
    var yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();

    setLang(detect(), false);
    initMenus();
    initEvents();
    initMagnetic();
    initJourney();
    initMap();

    STORE.onChange(function () { syncBag(); });

    if (window.MAISON_ADVISOR) {
      window.MAISON_ADVISOR.init({ t: t, fmtPrice: fmtPrice, go: navigate, trap: trapFocus });
    }

    mount(parseHash(), false);

    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', function () { updateJourneyRange(); queue(); }, { passive: true });
    if (window.ResizeObserver) {
      new ResizeObserver(updateJourneyRange).observe(document.body);
    }
    updateJourneyRange();
    onScroll();
    if (!flags.reduced) requestAnimationFrame(idleLoop);

    if (flags.reduced) { journeyReady = true; }
    pageLoaded = document.readyState === 'complete';
    if (!pageLoaded) addEventListener('load', function () { pageLoaded = true; releaseLoader(); });
    bootAt = Date.now();
    releaseLoader();
    setTimeout(function () { journeyReady = true; pageLoaded = true; releaseLoader(); }, 7000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
