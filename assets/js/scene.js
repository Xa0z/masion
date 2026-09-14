/* ==========================================================================
   MAISON — scene engine

   Scroll-scrubbed video that does not stutter. Three things make that work:

   1. PREFETCH TO BLOB — the file is fetched in full and handed to the video
      element as an object URL, so every seek is memory-local. No range
      request, no network stall mid-scroll.
   2. SEEK GATING — a new seek is never issued while one is in flight.
      Stacking seeks is what makes scrubbing feel like it is snagging.
   3. SHORT GOP — measured: g=6 seeks as fast as all-intra (24ms vs 27ms
      median) at a quarter of the bytes, so the saved budget goes into
      resolution and a lower CRF instead.

   The journey film also loads progressively: a light tier arrives first so
   scrubbing is immediate, then the high-resolution tier is fetched quietly
   and swapped in at the same frame.
   ========================================================================== */
(function () {
  'use strict';

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse  = matchMedia('(pointer: coarse)').matches;
  var small   = matchMedia('(max-width: 768px)').matches;
  var phone   = matchMedia('(max-width: 600px)').matches;

  var weak = (navigator.hardwareConcurrency || 4) <= 4 && coarse;
  var conn = navigator.connection || {};
  var saveData = !!conn.saveData;
  var slowNet = /^(slow-)?2g$/.test(conn.effectiveType || '');

  var probe = document.createElement('video');
  var canMp4  = !!probe.canPlayType('video/mp4; codecs="avc1.64001f"');
  var canWebm = !!probe.canPlayType('video/webm; codecs="vp9"');

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function ext() { return canMp4 ? '.mp4' : (canWebm ? '.webm' : null); }
  function mime(url) { return /\.webm$/.test(url) ? 'video/webm' : 'video/mp4'; }

  function pick(base, useSmall) {
    var e = ext(); if (!e) return null;
    var parts = String(base).split('|');
    if (parts.length > 1) return 'assets/video/' + (phone ? parts[1] : parts[0]) + e;
    return 'assets/video/' + base + (useSmall ? '-sm' : '') + e;
  }

  /* Which products carry turntable footage. */
  var SPINS = {
    khair:   { base: 'khair',            poster: 'assets/img/poster-khair.jpg'  },
    sceptre: { base: 'flacon|flacon-sq', poster: 'assets/img/poster-flacon.jpg' }
  };
  function spinFor(id) {
    if (reduced || saveData || weak || slowNet) return null;
    var s = SPINS[id];
    return (s && pick(s.base, small)) ? s : null;
  }

  /* ----------------------------------------------------------------------
     prefetch — whole file into memory, with real progress
     ---------------------------------------------------------------------- */
  function prefetch(url, onProgress) {
    return fetch(url, { credentials: 'same-origin' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var total = +(res.headers.get('content-length') || 0);
      if (!res.body || !res.body.getReader || !total) return res.blob();

      var reader = res.body.getReader();
      var chunks = [], got = 0;
      return (function pump() {
        return reader.read().then(function (r) {
          if (r.done) return new Blob(chunks, { type: mime(url) });
          chunks.push(r.value);
          got += r.value.length;
          if (onProgress) onProgress(clamp(got / total, 0, 1));
          return pump();
        });
      })();
    });
  }

  /* ----------------------------------------------------------------------
     VideoScrubber
     ---------------------------------------------------------------------- */
  function VideoScrubber(opts) {
    this.el       = opts.el;
    this.src      = pick(opts.base, small);
    this.hiSrc    = opts.hiBase ? pick(opts.hiBase, false) : null;
    this.range    = opts.range;
    this.onFrame  = opts.onFrame || null;
    this.onReady  = opts.onReady || null;
    this.onProg   = opts.onProgress || null;
    this.manual   = !!opts.manual;
    this.fps      = opts.fps || 12;        // source rate, for frame quantising
    this._frame   = -1;

    this.progress = 0;
    this.current  = 0;
    this.target   = 0;
    this.duration = 0;
    this.ready    = false;
    this.active   = !!opts.eager;
    this._url     = null;
    this._last    = 0;

    if (!this.src) { if (this.onReady) this.onReady(false); return; }
    if (saveData) { if (this.onReady) this.onReady(false); return; }

    if (opts.eager) this._start();
    else this._observe();
  }

  VideoScrubber.prototype._observe = function () {
    var self = this, started = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        self.active = e.isIntersecting;
        if (e.isIntersecting && !started) { started = true; self._start(); }
      });
    }, { rootMargin: '150% 0px' });
    io.observe(this.el);
  };

  VideoScrubber.prototype._start = function () {
    var self = this;
    prefetch(this.src, this.onProg)
      .then(function (blob) { return self._attach(blob); })
      .then(function () {
        if (self.onReady) self.onReady(true);
        if (self.hiSrc && self.hiSrc !== self.src) self._upgrade();
      })
      .catch(function () {
        // network or CORS trouble: stream it the ordinary way rather than fail
        self._attachDirect(self.src);
      });
  };

  VideoScrubber.prototype._attach = function (blob) {
    var self = this, v = this.el;
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob);
      function onMeta() {
        self.duration = v.duration || 0;
        cleanup();
        if (self._url) URL.revokeObjectURL(self._url);
        self._url = url;
        // paint the first frame before revealing
        v.addEventListener('seeked', function once () {
          v.removeEventListener('seeked', once);
          v.classList.add('is-ready');
          self.ready = true;
          resolve();
        }, { once: true });
        try { v.currentTime = self.current || 0.001; } catch (e) { resolve(); }
      }
      function onErr() { cleanup(); URL.revokeObjectURL(url); reject(new Error('decode')); }
      function cleanup() {
        v.removeEventListener('loadedmetadata', onMeta);
        v.removeEventListener('error', onErr);
      }
      v.addEventListener('loadedmetadata', onMeta);
      v.addEventListener('error', onErr);
      v.src = url;
      v.load();
    });
  };

  VideoScrubber.prototype._attachDirect = function (url) {
    var self = this, v = this.el;
    v.addEventListener('loadedmetadata', function () {
      self.duration = v.duration || 0;
      try { v.currentTime = 0.001; } catch (e) {}
    }, { once: true });
    v.addEventListener('seeked', function once () {
      v.removeEventListener('seeked', once);
      v.classList.add('is-ready');
      self.ready = true;
      if (self.onReady) self.onReady(true);
    });
    v.src = url;
    v.load();
  };

  /* quietly fetch the high-resolution tier and swap it in at the same frame */
  VideoScrubber.prototype._upgrade = function () {
    var self = this;
    if (slowNet || conn.saveData) return;
    prefetch(self.hiSrc).then(function (blob) {
      var at = self.current;
      return self._attach(blob).then(function () {
        self.current = at;
        self._frame = -1;                  // force a repaint on the new source
        try { self.el.currentTime = at; } catch (e) {}
      });
    }).catch(function () { /* the light tier is already good */ });
  };

  VideoScrubber.prototype.setProgress = function (p) { this.progress = clamp(p, 0, 1); };

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

    // frame-rate independent easing, so gating a seek does not slow the glide
    var now = performance.now();
    var dt = this._last ? Math.min(64, now - this._last) : 16.7;
    this._last = now;
    var k = reduced ? 1 : 1 - Math.pow(1 - 0.16, dt / 16.7);
    this.current = lerp(this.current, this.target, k);

    if (this.onFrame) this.onFrame(p);

    // never stack seeks — that is what makes scrubbing feel like it snags
    if (this.el.seeking) return;

    // Quantise to source frames. Seeking inside a frame we are already
    // showing costs a full seek round-trip and changes nothing on screen,
    // so only move when the visible frame actually changes.
    var frame = Math.round(this.current * this.fps);
    var max = Math.floor((this.duration - 0.001) * this.fps);
    if (frame < 0) frame = 0;
    if (frame > max) frame = max;
    if (frame === this._frame) return;
    this._frame = frame;

    try { this.el.currentTime = (frame + 0.5) / this.fps; } catch (e) {}
  };

  /* ----------------------------------------------------------------------
     360° product viewer
     ---------------------------------------------------------------------- */
  var liveSpin = null;

  function mountSpin(host, video, spin, onProgress) {
    if (liveSpin) { liveSpin.stop(); liveSpin = null; }
    if (!host || !video || !spin) return null;

    var s = new VideoScrubber({
      el: video, base: spin.base, manual: true, eager: true,
      fps: 24,                                   // turntables are cut at 24fps
      onProgress: onProgress,
      onReady: function (ok) { host.classList.toggle('is-loaded', !!ok); }
    });
    if (!s.src) return null;
    host.classList.add('has-spin');

    var raf = null, running = true, visible = true;
    var dragging = false, startX = 0, startP = 0, touched = false;
    var t0 = performance.now();

    function frame(now) {
      if (!running) return;
      if (visible) {
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

    // a turntable is a control, so it must be operable from the keyboard too
    host.setAttribute('tabindex', '0');
    host.setAttribute('role', 'img');
    function onKey(e) {
      var step = e.shiftKey ? 0.12 : 0.035;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { touched = true; s.setProgress((s.progress + step) % 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { touched = true; s.setProgress((s.progress - step + 1) % 1); }
      else if (e.key === 'Home') { touched = true; s.setProgress(0); }
      else return;
      e.preventDefault();
    }
    host.addEventListener('keydown', onKey);

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
      host.removeEventListener('keydown', onKey);
      removeEventListener('mousemove', onMove);
      removeEventListener('mouseup', end);
      if (s._url) { try { URL.revokeObjectURL(s._url); } catch (e) {} }
      try { video.removeAttribute('src'); video.load(); } catch (e) {}
    };

    liveSpin = s;
    return s;
  }

  window.MAISON_SCENE = {
    VideoScrubber: VideoScrubber,
    mountSpin: mountSpin,
    spinFor: spinFor,
    pick: pick,
    prefetch: prefetch,
    flags: { reduced: reduced, small: small, phone: phone, weak: weak,
             coarse: coarse, saveData: saveData, slowNet: slowNet }
  };
})();
