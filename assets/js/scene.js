/* ==========================================================================
   MAISON — scene engine
   1. VideoScrubber : scroll-driven 3D turntable playback (all-intra encode,
                      so seeking is frame-accurate and smooth)
   2. Atmos         : a restrained dust-mote field over the hero
   Both degrade to a static poster on weak devices or reduced-motion.
   ========================================================================== */
(function () {
  'use strict';

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse  = matchMedia('(pointer: coarse)').matches;
  var small   = matchMedia('(max-width: 768px)').matches;   // lighter encodes
  var phone   = matchMedia('(max-width: 600px)').matches;   // square-cut art

  /* device capability sniff — keeps the heavy path off weak hardware */
  var weak = (navigator.hardwareConcurrency || 4) <= 4 && coarse;
  var saveData = navigator.connection && navigator.connection.saveData;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ----------------------------------------------------------------------
     VideoScrubber
     ---------------------------------------------------------------------- */
  /* Prefer H.264 (smaller here, and universal); fall back to VP9 for builds
     compiled without proprietary codecs. */
  var probe = document.createElement('video');
  var canMp4  = !!probe.canPlayType('video/mp4; codecs="avc1.64001f"');
  var canWebm = !!probe.canPlayType('video/webm; codecs="vp9"');

  function pick(base, useSmall) {
    // a base may be "landscape|square" — the square art is cut for phones
    var parts = String(base).split('|');
    var stem;
    if (parts.length > 1) {
      // art direction follows the layout breakpoint, not the file-size one
      stem = 'assets/video/' + (phone ? parts[1] : parts[0]);
    } else {
      stem = 'assets/video/' + base + (useSmall ? '-sm' : '');
    }
    if (canMp4)  return stem + '.mp4';
    if (canWebm) return stem + '.webm';
    return null;                        // no decodable source: poster stays
  }

  function VideoScrubber(opts) {
    this.el       = opts.el;
    this.src      = pick(opts.base, small);
    this.range    = opts.range;          // () => {start, end} in page px
    this.onFrame  = opts.onFrame || null;
    this.loaded   = false;
    this.current  = 0;
    this.target   = 0;
    this.duration = 0;
    this.active   = false;

    if (saveData || !this.src) return;   // data-saver or no codec: poster only
    this._observe();
  }

  VideoScrubber.prototype._observe = function () {
    var self = this;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        self.active = e.isIntersecting;
        if (e.isIntersecting && !self.loaded) { self._load(); }
      });
    }, { rootMargin: '200% 0px' });
    io.observe(this.el);
  };

  VideoScrubber.prototype._load = function () {
    this.loaded = true;
    var self = this, v = this.el;

    v.addEventListener('loadedmetadata', function () {
      self.duration = v.duration || 0;
      // paint the first frame, then reveal — avoids any blank flash
      try { v.currentTime = 0.001; } catch (err) {}
    }, { once: true });

    v.addEventListener('seeked', function once () {
      v.classList.add('is-ready');
      v.removeEventListener('seeked', once);
    });

    v.addEventListener('error', function () { self.duration = 0; }, { once: true });

    v.src = this.src;
    v.load();
  };

  VideoScrubber.prototype.update = function () {
    if (!this.duration || !this.active) return;

    var r = this.range();
    var span = r.end - r.start;
    if (span <= 0) return;

    var p = clamp((window.scrollY - r.start) / span, 0, 1);
    this.target = p * (this.duration - 0.05);

    // reduced motion: snap, no easing loop
    this.current = reduced ? this.target : lerp(this.current, this.target, 0.14);

    if (Math.abs(this.current - this.el.currentTime) > 0.012) {
      try { this.el.currentTime = this.current; } catch (err) {}
    }
    if (this.onFrame) this.onFrame(p);
  };

  /* ----------------------------------------------------------------------
     Atmos — dust motes in the hero light. Cheap, paused when off-screen.
     ---------------------------------------------------------------------- */
  function Atmos(canvas) {
    if (!canvas || reduced || weak) { if (canvas) canvas.style.display = 'none'; return; }
    this.c = canvas;
    this.x = canvas.getContext('2d', { alpha: true });
    if (!this.x) { canvas.style.display = 'none'; return; }

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.n   = small ? 22 : 54;           // fewer motes on small screens
    this.on  = true;
    this.parts = [];
    this._resize();
    this._seed();

    var self = this;
    addEventListener('resize', function () { self._resize(); self._seed(); }, { passive: true });

    var io = new IntersectionObserver(function (e) { self.on = e[0].isIntersecting; });
    io.observe(canvas);

    this._tick = this._tick.bind(this);
    requestAnimationFrame(this._tick);
  }

  Atmos.prototype._resize = function () {
    var r = this.c.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    this.c.width  = Math.round(this.w * this.dpr);
    this.c.height = Math.round(this.h * this.dpr);
    this.x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  };

  Atmos.prototype._seed = function () {
    this.parts = [];
    for (var i = 0; i < this.n; i++) {
      this.parts.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        z: 0.35 + Math.random() * 0.65,          // depth → size + speed
        r: 0.7 + Math.random() * 1.9,
        a: 0.05 + Math.random() * 0.22,
        vy: -(0.06 + Math.random() * 0.16),
        vx: (Math.random() - 0.5) * 0.12,
        ph: Math.random() * Math.PI * 2
      });
    }
  };

  Atmos.prototype._tick = function (t) {
    requestAnimationFrame(this._tick);
    if (!this.on) return;

    var x = this.x;
    x.clearRect(0, 0, this.w, this.h);

    for (var i = 0; i < this.parts.length; i++) {
      var p = this.parts[i];
      p.y += p.vy * p.z;
      p.x += p.vx * p.z + Math.sin(t * 0.0004 + p.ph) * 0.12;

      if (p.y < -8) { p.y = this.h + 8; p.x = Math.random() * this.w; }
      if (p.x < -8) p.x = this.w + 8;
      if (p.x > this.w + 8) p.x = -8;

      var tw = 0.72 + Math.sin(t * 0.0011 + p.ph) * 0.28;
      var rad = p.r * p.z;

      var g = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad * 3.2);
      g.addColorStop(0, 'rgba(255,246,230,' + (p.a * tw) + ')');
      g.addColorStop(1, 'rgba(255,246,230,0)');
      x.fillStyle = g;
      x.beginPath();
      x.arc(p.x, p.y, rad * 3.2, 0, Math.PI * 2);
      x.fill();
    }
  };

  window.MAISON_SCENE = {
    VideoScrubber: VideoScrubber,
    Atmos: Atmos,
    pick: pick,
    flags: { reduced: reduced, small: small, phone: phone, weak: weak, coarse: coarse }
  };
})();
