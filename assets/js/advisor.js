/* ==========================================================================
   MAISON — Advisor
   A guided beauty consultant. Deterministic and on-device: it routes the
   shopper through the counters and recommends from the real catalogue.
   It does NOT call a language model — a static site cannot hold an API key
   safely. Connecting one needs a small server-side proxy; the flow below is
   the conversation design that would sit in front of it.
   ========================================================================== */
(function () {
  'use strict';

  var I18N, STORE, CAT, t, fmtPrice, go;
  var log, panel, launcher, input, form;
  var busy = false;

  /* ---------- conversation graph ---------- */
  var NODES = {
    root: {
      say: ['ai.greet'],
      chips: ['scent', 'skin', 'gift', 'delivery', 'store']
    },
    scent: {
      echo: 'ai.q.scent',
      say: ['ai.scent.ask'],
      chips: ['scent.warm', 'scent.soft']
    },
    'scent.warm': { echo: 'ai.scent.warm', say: ['ai.scent.warmA'], recs: ['khair'], then: 'more' },
    'scent.soft': { echo: 'ai.scent.soft', say: ['ai.scent.softA'], recs: ['sceptre'], then: 'more' },
    skin: {
      echo: 'ai.q.skin',
      say: ['ai.skin.ask'],
      chips: ['skin.dull', 'skin.dry', 'skin.tired']
    },
    'skin.dull':  { echo: 'ai.skin.dull',  say: ['ai.skin.dullA'],  recs: ['serum-c'], then: 'more' },
    'skin.dry':   { echo: 'ai.skin.dry',   say: ['ai.skin.dryA'],   recs: ['cleanser', 'cream-night'], then: 'more' },
    'skin.tired': { echo: 'ai.skin.tired', say: ['ai.skin.tiredA'], recs: ['eye-cream'], then: 'more' },
    gift:     { echo: 'ai.q.gift',     say: ['ai.gift.a'],     recs: ['khair', 'sceptre'], then: 'more' },
    delivery: { echo: 'ai.q.delivery', say: ['ai.delivery.a'], then: 'more' },
    store:    { echo: 'ai.q.store',    say: ['ai.store.a'],    then: 'more' },
    more:     { say: ['ai.more'], chips: ['scent', 'skin', 'gift', 'delivery', 'store'] },
    nomatch:  { say: ['ai.nomatch'], chips: ['scent', 'skin', 'gift', 'delivery', 'store'] }
  };

  var CHIP_LABEL = {
    scent: 'ai.q.scent', skin: 'ai.q.skin', gift: 'ai.q.gift',
    delivery: 'ai.q.delivery', store: 'ai.q.store',
    'scent.warm': 'ai.scent.warm', 'scent.soft': 'ai.scent.soft',
    'skin.dull': 'ai.skin.dull', 'skin.dry': 'ai.skin.dry', 'skin.tired': 'ai.skin.tired'
  };

  /* Free-text routing. Deliberately narrow: the advisor says what it does
     not know rather than inventing an answer. */
  var INTENTS = [
    { node: 'scent.warm', re: /\b(oud|عود|عوود|amber|عنبر|عەنبەر|warm|دافئ|گەرم|deep|strong|قوي|بەهێز|خەیر|khair|خير)\b/i },
    { node: 'scent.soft', re: /\b(light|خفيف|سووک|soft|ناعم|نەرم|fresh|منعش|clean|vanilla|فانيليا|ڤانیلیا|sceptre|صولجان)\b/i },
    { node: 'scent',      re: /\b(perfume|scent|عطر|عەتر|بۆن|fragrance|بۆنی)\b/i },
    { node: 'skin.dull',  re: /\b(dull|بهتان|dark|داكن|تاریک|spot|بقع|vitamin|فيتامين|ڤیتامین|bright|إشراق|درەوشان|tone|لون)\b/i },
    { node: 'skin.dry',   re: /\b(dry|جاف|وشک|tight|شد|ڕاکێشان|flak|تقشر|moistur|ترطيب|شێدار|cream|كريم|کرێم|cleans|غسول|شۆر)\b/i },
    { node: 'skin.tired', re: /\b(eye|عين|چاو|tired|متعب|ماندوو|dark circle|هالات|puff|انتفاخ)\b/i },
    { node: 'skin',       re: /\b(skin|بشرة|پێست|face|وجه|ڕوو|acne|حب الشباب|serum|سيروم|سیرۆم)\b/i },
    { node: 'gift',       re: /\b(gift|هدية|دیاری|present|birthday|عيد|ڕۆژی لەدایکبوون)\b/i },
    { node: 'delivery',   re: /\b(deliver|shipping|توصيل|گەیاندن|order|طلب|داواکاری|pay|دفع|پارە|cost|سعر|نرخ|price|كم|چەند)\b/i },
    { node: 'store',      re: /\b(where|أين|لەکوێ|store|محل|فرۆشگا|shop|location|موقع|شوێن|address|عنوان|ناونیشان|erbil|أربيل|هەولێر|map|خريطة|نەخشە)\b/i },
    { node: 'hair',       re: /\b(hair|شعر|قژ|oil|زيت|ڕۆن)\b/i },
    { node: 'lip',        re: /\b(lip|شفاه|لێو|colour|color|lipstick|أحمر)\b/i }
  ];

  var EXTRA = {
    hair: { say: ['p.hair-oil.desc'], recs: ['hair-oil'], then: 'more' },
    lip:  { say: ['p.lip-colour.desc'], recs: ['lip-colour'], then: 'more' }
  };

  /* ---------- rendering ---------- */
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  function scrollDown() { log.scrollTop = log.scrollHeight; }

  function addMsg(text, mine) {
    var m = el('div', 'msg' + (mine ? ' msg--me' : ''));
    var b = el('div', 'msg__bubble');
    b.appendChild(el('p', null, text));
    m.appendChild(b);
    log.appendChild(m);
    scrollDown();
  }

  function addChips(keys) {
    var wrap = el('div', 'chips');
    keys.forEach(function (k) {
      var b = el('button', null, t(CHIP_LABEL[k] || k));
      b.type = 'button';
      b.addEventListener('click', function () {
        if (busy) return;
        retire(wrap);                 // a spent quick reply must not stay live
        visit(k);
      });
      wrap.appendChild(b);
    });
    log.appendChild(wrap);
    scrollDown();
  }

  /* Once answered, a chip row is history: it collapses so the shopper is
     never choosing from a stale question. */
  function retire(wrap) {
    if (!wrap || wrap.__spent) return;
    wrap.__spent = true;
    wrap.remove();
  }

  function addRecs(ids) {
    ids.forEach(function (id) {
      var p = STORE.byId(id); if (!p) return;
      var a = el('a', 'airec');
      a.href = '#/p/' + p.id;
      a.setAttribute('data-nav', '');

      var im = el('span', 'airec__img');
      var img = document.createElement('img');
      img.src = 'assets/img/' + p.img + '-720.jpg';
      img.alt = '';
      img.loading = 'lazy';
      im.appendChild(img);

      var b = el('span', 'airec__b');
      b.appendChild(el('strong', null, t('p.' + p.id + '.name')));
      b.appendChild(el('span', null, fmtPrice(p.price)));

      a.appendChild(im);
      a.appendChild(b);
      a.appendChild(el('span', 'airec__go', t('ai.view')));
      log.appendChild(a);
    });
    scrollDown();
  }

  function typing(on) {
    var old = log.querySelector('.advisor__typing');
    if (old) old.remove();
    if (!on) return;
    var d = el('div', 'advisor__typing');
    d.innerHTML = '<i></i><i></i><i></i>';
    log.appendChild(d);
    scrollDown();
  }

  /* ---------- flow ---------- */
  function say(node, delay) {
    busy = true;
    typing(true);
    setTimeout(function () {
      typing(false);
      (node.say || []).forEach(function (k) { addMsg(t(k)); });
      if (node.recs && node.recs.length) {
        addMsg(t('ai.rec'));
        addRecs(node.recs);
      }
      if (node.chips) addChips(node.chips);
      busy = false;
      if (node.then) {
        setTimeout(function () { visit(node.then, true); }, 520);
      }
    }, delay || 620);
  }

  function visit(key, silent) {
    var node = NODES[key] || EXTRA[key];
    if (!node) { node = NODES.nomatch; }
    if (!silent && node.echo) addMsg(t(node.echo), true);
    say(node);
  }

  function ask(text) {
    var q = String(text || '').trim();
    if (!q) return;
    addMsg(q, true);
    var hit = null;
    for (var i = 0; i < INTENTS.length; i++) {
      if (INTENTS[i].re.test(q)) { hit = INTENTS[i].node; break; }
    }
    say(hit ? (NODES[hit] || EXTRA[hit]) : NODES.nomatch);
  }

  function reset() {
    log.innerHTML = '';
    busy = false;
    visit('root', true);
  }

  /* ---------- open / close ---------- */
  function open() {
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    launcher.classList.add('is-hidden');
    launcher.setAttribute('aria-expanded', 'true');
    if (!log.children.length) reset();
    setTimeout(function () { scrollDown(); }, 60);
  }
  function close() {
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    launcher.classList.remove('is-hidden');
    launcher.setAttribute('aria-expanded', 'false');
  }

  /* ---------- boot ---------- */
  function init(api) {
    I18N = window.MAISON_I18N; STORE = window.MAISON_STORE; CAT = window.MAISON_CATALOGUE;
    t = api.t; fmtPrice = api.fmtPrice; go = api.go;

    panel    = document.getElementById('advisor');
    launcher = document.getElementById('advisorLaunch');
    log      = document.getElementById('advisorLog');
    input    = document.getElementById('advisorInput');
    form     = document.getElementById('advisorForm');
    if (!panel || !launcher) return;

    launcher.addEventListener('click', open);
    document.getElementById('advisorClose').addEventListener('click', close);
    document.getElementById('advisorReset').addEventListener('click', reset);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      ask(input.value);
      input.value = '';
    });

    document.addEventListener('click', function (e) {
      var trigger = e.target.closest ? e.target.closest('[data-advisor]') : null;
      if (trigger) { e.preventDefault(); open(); }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) close();
    });

    // following a recommendation closes the sheet on small screens
    panel.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-nav]') && window.innerWidth <= 1024) close();
    });
  }

  /* Language changes redraw the conversation, but only once the panel exists
     and has actually been opened — boot sets the language before init runs. */
  function relabel() {
    if (!log || !log.children.length) return;
    reset();
  }

  window.MAISON_ADVISOR = { init: init, open: open, close: close, relabel: relabel };
})();
