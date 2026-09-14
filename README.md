# Maison — 3D marketing site

A design-only marketing experience for **Maison Cosmetic** (@maison.cosmetic) — a
beauty house in Kurdistan/Iraq carrying its own *Maison Luxury Perfumes* line
alongside curated skincare, cosmetics and hair care.

Static site. No backend, no database, no build step. Open `index.html`.

**Live:** https://maison-cosmetic-ahmads-projects-3806fa63.vercel.app

Deployed on Vercel from this branch (it is the repo's default branch, so Vercel
treats it as production). Every push redeploys automatically. The GitHub repo is
private; the deployed site is public — Vercel Authentication is turned off so the
marketing page is reachable without a login.

---

## Brand research

The visual system is derived from the brand's own posts, not invented:

| Signal | Where it came from | How it is used |
|---|---|---|
| Vermillion red `#EE4028` + bone grey `#E4E1DC` | Their poster artwork — full-bleed split panels | Core palette, and the site's section rhythm |
| **Vertical split panel**, product straddling the seam | Their recurring grid device | Hero plate, collection tiles, the whole 3D art direction |
| Letterspaced high-contrast serif `MAISON` wordmark | Their `MAISON / LUXURY PERFUMES` and `MAISON / COSMETIC` lockups | Cormorant Garamond, `.3em` tracking |
| Gold packaging accents | Their perfume caps and filigree | `--gold`, used only on the signature product |
| Kurdish + Arabic + English copy | Their bilingual captions | Full trilingual site with RTL mirroring |
| *Khair* — Oud · Davana · Pink Pepper | Printed in their own post | The Signature section, note pyramid verbatim |

Everything else — product names, prices, journal headlines — is a clearly
labelled design placeholder. **No invented statistics or testimonials.**
Vessels in the imagery are unbranded on purpose so real packaging can replace
them without redesign.

## Art direction

Established before any asset was generated, and applied to every one:

- **Light** — single large softbox, upper left, 4500 K, deep soft falloff, warm bounce
- **Material** — glass, brushed gold, ceramic, plaster, silk. No plastic, no chrome, no iridescence
- **Camera** — 100 mm macro, f/4–f/5.6, eye level, negative space reserved for type
- **Motion** — 0.9–1.4 s, `cubic-bezier(.22,1,.36,1)`, opacity + small translate only

## The 3D

Scroll-driven turntable footage, generated with Higgsfield and **scrubbed by
scroll position** rather than played. Videos are re-encoded **all-intra**
(`-g 1`) so every frame is a keyframe and seeking is frame-accurate.

- Desktop hero → landscape plate · phones (≤600px) → a **separate square cut** where the flacon is whole
- MP4/H.264 preferred, **VP9/WebM fallback** for browsers built without proprietary codecs
- `-sm` encodes for ≤768px, lazy-loaded via `IntersectionObserver`, poster shown until the first frame is decoded
- Skipped entirely on `save-data`, `prefers-reduced-motion`, or when no codec decodes — the poster carries the section

> **Deployment note:** scrubbing needs HTTP **range requests** (`206`). Every real
> static host does this (nginx, Apache, Netlify, Vercel, Pages, S3/CloudFront).
> Python's `http.server` does **not** — video will load but refuse to seek.

## Trilingual + RTL

English · العربية · کوردی (Sorani). Every string lives in
`assets/js/i18n.js` — 125 keys × 3 languages, nothing hard-coded in markup.

Switching language sets `lang`, `dir` and `data-font` on `<html>`. The layout
mirrors for real because it is built on **logical properties**
(`margin-inline`, `inset-inline`, `border-inline-start`) — including the hero
plate, which flips so the copy always sits on the bone half. Choice persists in
`localStorage`.

Fonts are **self-hosted** (296 KB total) — no third-party request, which matters
on regional networks. Sorani coverage (ڕ ڵ ۆ ێ ژ چ پ گ) verified against the
shipped subsets.

## Files

```
index.html
assets/css/maison.css     design system + every section + responsive + RTL
assets/js/i18n.js         trilingual dictionary
assets/js/scene.js        scroll-scrub engine + hero dust motes
assets/js/app.js          i18n engine, instant navigation, reveals, micro-interactions
assets/fonts/             self-hosted woff2
assets/img/ assets/video/ campaign assets
```

## Verified

- 8 widths (1920→375) × 3 languages = 24 combinations: no horizontal overflow,
  no overlap, no console errors, no tap target under 44px
- 21 interaction tests: loader, instant curtain navigation (0 document
  re-fetches), language switch + RTL + persistence, mobile menu, scroll lock
- Navigation is genuinely instant — `scroll-behavior` is `auto` and the curtain
  carries the transition, so the jump completes before it lifts
