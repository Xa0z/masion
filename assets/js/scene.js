/* ==========================================================================
   MAISON — scene engine
   VideoScrubber : scroll-driven playback of all-intra footage. Used for the
                   journey film behind the site, and for the 360° viewers on
                   the product pages (which also respond to drag).
   Degrades to a poster on weak devices, save-data, reduced motion, or when
   no shipped codec decodes.
   ========================================================================== */
(function () {
  'use strict';

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse  = matchMedia('(pointer: coarse)').matches;
  var small   = matchMedia('(max-width: 768px)').matches;
  var phone   = matchMedia('(max-width: 600px)').matches;

  var weak = (navigator.hardwareConcurrency || 4) <= 4 && coarse;
  var saveData = !!(navigator.connection && navigator.connection.saveData);

  var probe = document.createElement('video');
  var canMp4  = !!probe.canPlayType('video/mp4; codecs="avc1.64001f"');
  var canWebm = !!probe.canPlayType('video/webm; codecs="vp9"');

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function pick(base, useSmall) {
    var parts = String(base).split('|');
    var stem;
    if (parts.length > 1) stem = 'assets/video/' + (phone ? parts[1] : parts[0]);
    else stem = 'assets/video/' + base + (useSmall ? '-sm' : '');
    if (canMp4)  return stem + '.mp4';
    if (canWebm) return stem + '.webm';
    return null;
  }

  /* which products have turntable footage, and what to show before it loads */
  var SPINS = {
    khair:   { base: 'khair',            poster: 'assets/img/poster-khair.jpg'  },
    sceptre: { base: 'flacon|flacon-sq', poster: 'assets/img/poster-flacon.jpg' }
  };
  function spinFor(id) {
    if (reduced || saveData || weak) return null;
    var s = SPINS[id];
    return (s && pick(s.base, small)) ? s : null;
  }

  /* ----------------------------------------------------------------------
     VideoScrubber
     ---------------------------------------------------------------------- */
  function VideoScrubber(opts) {
    this.el      = opts.el;
    this.src     = pick(opts.base, small);
    this.range   = opts.range;
    this.onFrame = opts.onFrame || null;
    this.manual  = !!opts.manual;          // driven by drag instead of scroll
    this.progress = 0;
    this.loaded  = false;
    this.current = 0;
    this.target  = 0;
    this.duration = 0;
    this.active  = !!opts.eager;

    if (saveData || !this.src) return;
    if (opts.eager) this._load(); else this._observe();
    if (!opts.eager) this._observe();
  }

  VideoScrubber.prototype._observe = function () {
    var self = this;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        self.active = e.isIntersecting;
        if (e.isIntersecting && !self.loaded) self._load();
      });
    }, { rootMargin: '150% 0px' });
    io.observe(this.el);
  };

  VideoScrubber.prototype._load = function () {
    if (this.loaded) return;
    this.loaded = true;
    var self = this, v = this.el;

    v.addEventListener('loadedmetadata', function () {
      self.duration = v.duration || 0;
      try { v.currentTime = 0.001; } catch (e) {}
    }, { once: true });

    v.addEventListener('seeked', function once () {
      v.classList.add('is-ready');
      v.removeEventListener('seeked', once);
    });

    v.addEventListener('error', function () { self.duration = 0; }, { once: true });

    v.src = this.src;
    v.load();
  };

  VideoScrubber.prototype.setProgress = function (p) {
    this.progress = clamp(p, 0, 1);
  };

  VideoScrubber.prototype.update = function () {
    if (!this.duration || !this.active) return;

    var p = this.progress;
    if (!this.manual) {
      var r = this.range();
      var span = r.end - r.start;
      if (span <= 0) return;
      p = clamp((window.scrollY - r.start) / span, 0, 1);
      this.progress = p;
    }

    this.target = p * (this.duration - 0.05);
    this.current = reduced ? this.target : lerp(this.current, this.target, 0.12);

    if (Math.abs(this.current - this.el.currentTime) > 0.012) {
      try { this.el.currentTime = this.current; } catch (e) {}
    }
    if (this.onFrame) this.onFrame(p);
  };

  /* ----------------------------------------------------------------------
     360° product viewer — drag to spin, and it eases while visible
     ---------------------------------------------------------------------- */
  var liveSpin = null;

  function mountSpin(host, video, spin) {
    // tear down whatever the previous product page left running
    if (liveSpin) { liveSpin.stop(); liveSpin = null; }
    if (!host || !video || !spin) return null;

    var s = new VideoScrubber({ el: video, base: spin.base, manual: true });
    if (!s.src) return null;
    s.active = true;
    s._load();
    host.classList.add('has-spin');

    var raf = null, running = true, visible = true;
    var dragging = false, startX = 0, startP = 0, touched = false;
    var t0 = performance.now();

    function frame(now) {
      if (!running) return;
      if (visible) {
        // drift slowly until the shopper takes hold of it
        if (!touched && !dragging && s.duration) s.setProgress(((now - t0) / 14000) % 1);
        s.update();
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    function begin(x) { dragging = true; touched = true; startX = x; startP = s.progress; }
    function move(x) {
      if (!dragging) return;
      var w = host.getBoundingClientRect().width || 1;
      var dx = (x - startX) / w;
      if (document.documentElement.getAttribute('dir') === 'rtl') dx = -dx;
      s.setProgress(((startP + dx) % 1 + 1) % 1);
    }
    function end() { dragging = false; }

    function onDown(e) { e.preventDefault(); begin(e.clientX); }
    function onMove(e) { move(e.clientX); }
    function onTStart(e) { begin(e.touches[0].clientX); }
    function onTMove(e) { move(e.touches[0].clientX); }

    host.addEventListener('mousedown', onDown);
    addEventListener('mousemove', onMove);
    addEventListener('mouseup', end);
    host.addEventListener('touchstart', onTStart, { passive: true });
    host.addEventListener('touchmove', onTMove, { passive: true });
    host.addEventListener('touchend', end);

    var io = new IntersectionObserver(function (e) {
      visible = e[0].isIntersecting;
      s.active = visible;
    });
    io.observe(host);

    s.stop = function () {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      removeEventListener('mousemove', onMove);
      removeEventListener('mouseup', end);
      try { video.removeAttribute('src'); video.load(); } catch (err) {}
    };

    liveSpin = s;
    return s;
  }

  window.MAISON_SCENE = {
    VideoScrubber: VideoScrubber,
    mountSpin: mountSpin,
    spinFor: spinFor,
    pick: pick,
    flags: { reduced: reduced, small: small, phone: phone, weak: weak, coarse: coarse, saveData: saveData }
  };
})();
