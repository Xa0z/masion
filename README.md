# Maison — 3D marketing site & shop

A design-only storefront for **Maison Cosmetic** (@maison.cosmetic) — a beauty
house in Erbil, Kurdistan, carrying its own *Maison Luxury Perfumes* line
alongside curated skincare, cosmetics and hair care.

Static site. No backend, no database, no build step. Open `index.html`.

**Live:** https://maison-cosmetic-ahmads-projects-3806fa63.vercel.app

Deployed on Vercel from this branch (the repo's default, so Vercel treats it as
production). Every push redeploys. The GitHub repo is private; the deployed site
is public.

---

## Brand research

The visual system is derived from the brand's own posts, not invented:

| Signal | Where it came from | How it is used |
|---|---|---|
| Vermillion `#EE4028` + bone `#E4E1DC` | Their poster artwork — full-bleed split panels | Core palette; the product plates carry it against the dark UI |
| **Vertical split panel**, product on the seam | Their recurring grid device | Every generated product still is built on it |
| Letterspaced high-contrast serif wordmark | Their `MAISON / LUXURY PERFUMES` lockup | Cormorant Garamond, `.3em` tracking |
| Gold packaging accents | Their perfume caps and filigree | `--gold`, reserved for the signature product and primary buy action |
| Kurdish + Arabic + English captions | Their bilingual posts | Full trilingual site with real RTL mirroring |
| *Khair* — Oud · Davana · Pink Pepper | Printed in their own post | The Signature section and product page, verbatim |
| Erbil storefront, `53P5+C3C` | The location the client supplied | Embedded map + directions |

## The journey

One continuous **16.6s film sits behind the entire site**, scrubbed by scroll —
atelier, past the shelves, into macro texture, out to the flacon. Four generated
shots joined with slow cross-dissolves.

### Making it smooth

Scroll-scrubbed video stutters for three reasons. All three are addressed:

1. **Prefetch to a blob.** The file is fetched in full and handed to the video
   element as an object URL, so every seek is memory-local — no range request
   mid-scroll. The loader bar is the real byte progress, and the hero is not
   revealed until the film can actually scrub (~1.8s on a warm connection).
2. **Never stack seeks.** A new seek is only issued when none is in flight.
   Overlapping seeks are what makes scrubbing feel like it is snagging.
3. **Quantise to source frames.** Seeking inside a frame already on screen
   costs a full round-trip and changes nothing. Measured on a 90-step scroll:
   **54 seeks for 56 frame changes** — effectively no wasted work, and zero
   stalls.

### What actually costs latency

Measured, fully prefetched, both scroll directions (VP9, software decode):

| variant | size | fwd median | fwd p90 | back median |
|---|---|---|---|---|
| 960 g=3 | 4.03 MB | **12.3 ms** | 15.4 ms | 11.8 ms |
| 1280 g=3 | 5.45 MB | **13.4 ms** | 18.5 ms | 14.0 ms |
| 1280 g=6 | 2.98 MB | 17.1 ms | 25.6 ms | 14.5 ms |
| 1280 g=2 | 7.61 MB | 16.4 ms | 22.5 ms | 16.5 ms |
| 1920 g=3 | 8.40 MB | 23.0 ms | 30.7 ms | 21.3 ms |
| 1920 g=6 | 4.64 MB | 23.0 ms | 36.1 ms | 22.5 ms |

Three findings, all of which changed the build:

1. **Resolution dominates.** 1920 costs roughly double 1280. An earlier version
   of this site upgraded to a 1920 tier for "quality" — behind a 50–96% veil that
   detail is invisible, and it halved the frame rate of the scrub. **That tier is
   gone.** The quality went into a lower CRF at 1280 instead.
2. **`g=3` beats both `g=6` and `g=2`.** Fewer frames to decode per seek than
   `g=6`, without the bitrate penalty of `g=2`.
3. **`fastSeek()` is a red herring** — within noise of ordinary `currentTime`.

Bitrate matters too, but less: at 1280, CRF 18 → 20.9 ms and CRF 34 → 15 ms.

### Keeping up with a fast scroll

Two more things the loop does:

- **Snap the large gaps.** A flick can move the target seconds ahead. Easing
  through it would decode every frame in between and fall behind, so most of the
  distance closes at once and only the last stretch eases. A flick from the top
  to 90% of the page settles in **8 ms**.
- **Pace seeks to measured decode cost.** The loop times its own seeks and keeps
  a rolling average, then refuses to ask for a new frame faster than the device
  has actually been managing. Asking every animation frame oversubscribes the
  decoder and the main thread hitches.

Result on a 90-step scroll: **79 distinct frames, 77 seeks, zero stalls** — up
from 43 frames before this work. The 360 viewers drag at ~60 ms⁻¹ median with
zero stalls on both desktop and phone.

### Product 360°

The two products with turntable footage get a **drag-to-spin viewer**, prefetched
with a progress ring, drifting slowly until the shopper takes hold of it. Khair's
footage was **AI-upscaled to 2160×2880** (Topaz) — the filigree and the engraved
collar band genuinely resolve — then shipped at 1080×1440.

> **Note on "4K":** the source footage generates at 720–1080p, so shipping a 4K
> background would be upscaling, not detail — and a 4K all-intra film could never
> be prefetched, which is the thing that makes scrubbing smooth. The upscale was
> spent where resolution is actually examined: the product viewer.

- MP4/H.264 preferred, **VP9/WebM fallback** for browsers built without proprietary codecs
- Skipped on `save-data`, `prefers-reduced-motion`, 2G, or weak devices — the poster carries the page

> **Deployment note:** the blob prefetch means range requests are no longer on the
> critical path, but the direct-stream fallback still needs a host that serves
> `206`. Real static hosts do; Python's `http.server` does not.

## Shop, bag and checkout

Five instant client-side views: **home · shop · product · cart · checkout**.
Routing is hash-based and fetches no documents — the curtain is the transition.

- Bag lives in `localStorage` and survives reloads
- Delivery is the brand's real model: Erbil free, other cities 5,000–10,000 IQD, free over 100,000 IQD
- **Cash on delivery** — how the brand already ships. No card fields anywhere
- Placing an order builds a formatted summary and hands it to the customer to send via WhatsApp or Instagram. **Nothing is transmitted and no payment is taken**

Taking card payments would need a real backend and a payment provider; that is
deliberately not faked here.

## The advisor

A guided beauty consultant (`assets/js/advisor.js`): greeting → counter →
concern → a recommendation drawn from the real catalogue, with free-text routing
in all three languages.

It is **deterministic and on-device — it does not call a language model.** A
static page cannot hold an API key safely. The conversation design is what would
sit in front of one; wiring a real LLM needs a small server-side proxy. It says
what it does not know rather than inventing an answer.

## Trilingual + RTL

English · العربية · کوردی (Sorani). Every string lives in `assets/js/i18n.js` —
262 keys × 3 languages, nothing hard-coded in markup.

Switching sets `lang`, `dir` and `data-font` on `<html>`. The layout mirrors for
real because it is built on **logical properties**, including the 360 viewer's
drag direction. Choice persists in `localStorage`.

Fonts are **self-hosted** (296 KB) — no third-party request, which matters on
regional networks. Sorani coverage (ڕ ڵ ۆ ێ ژ چ پ گ) verified against the subsets.

## The map

The Erbil storefront is embedded live and opens into Google Maps for directions.

> The iframe points at `https://www.google.com/maps/embed?...&pb=...` directly,
> **not** the usual `/maps?q=…&output=embed`. That form 301-redirects with
> `X-Frame-Options: SAMEORIGIN`, which browsers enforce on the redirect, so it
> silently fails to frame. If the embed is blocked or unreachable anyway, a
> styled card with the address and a maps link takes its place.

## Files

```
index.html
assets/css/maison.css     design system, all views, responsive, RTL
assets/js/i18n.js         trilingual dictionary (262 keys)
assets/js/catalogue.js    product data (placeholder prices, clearly marked)
assets/js/store.js        bag, totals, delivery
assets/js/scene.js        scroll-scrub engine + 360 viewer
assets/js/advisor.js      guided advisor
assets/js/app.js          router, i18n engine, view rendering, checkout
assets/fonts/             self-hosted woff2
assets/img/ assets/video/ campaign assets
```

## Placeholder data

Product names, prices and descriptions are **design placeholders** for layout
review — the checkout says so on screen. Imagery uses unbranded vessels on
purpose so real packaging drops in without redesign. No invented statistics or
testimonials anywhere.

## Accessibility

Audited with axe-core across every view, and by hand for the things axe cannot
see. **Zero violations** on home, shop, product, cart, checkout and with the
advisor open.

- **Contrast** — computed for every token in use. The red panel was the one real
  failure (body copy at 3.14:1, the label at 2.27:1). Fixed by setting near-black
  type on the brand vermillion — **4.99:1**, and closer to the way the brand sets
  type on red in its own artwork than white-on-red was.
- **Focus follows the route.** A client-side view change behaves like a page
  change: focus moves to the new view's heading and the change is announced
  through a dedicated live region — not an `aria-live` on the whole `<main>`,
  which would narrate every DOM mutation.
- **Focus traps** on the advisor dialog and the mobile menu, each restoring focus
  to the control that opened it on Escape.
- **The 360 viewer is a real control** — focusable, with arrow keys to turn it
  (Shift for a coarser step, Home to reset) and a described purpose.
- Skip link, named image-only links, corrected heading order, and a visible
  focus ring on everything.

> One audit note worth keeping: `[data-reveal]` starts at `opacity:0`, and axe
> skips invisible nodes — so the first clean run was a false negative. The audit
> forces every reveal on before scanning.

## Findability

Open Graph and Twitter cards with a real 1200×630 image, canonical URL, locale
alternates, and `HealthAndBeautyBusiness` structured data carrying the Erbil
address, the map link, IQD currency, cash-on-delivery and the three languages —
which is what actually helps a physical shop surface locally.

## Verified

- **120 checks** — 5 views × 8 widths (1920→375) × 3 languages: no horizontal
  overflow, no overlap, no console errors, no tap target under 30px
- **24 interaction tests** — loader, instant routing (0 document re-fetches),
  scroll-scrubbing, filter, sort, bag persistence, delivery-fee maths, order
  placement, advisor conversation, language switch + RTL, mobile menu
- **Scrub benchmark** — 0 stalls over a 90-step scroll, 77 seeks for 79 frame
  changes, and a top-to-90% flick settling in 8 ms; 360 viewers drag at ~60fps
  with 0 stalls on desktop and phone
- **axe-core** — 0 violations across all five views plus the advisor open
- **12 keyboard tests** — skip link, focus on route change, live announcement,
  arrow-key product rotation, advisor and menu focus traps with focus restored
