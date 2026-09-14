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

### Getting the quality up

All-intra (`-g 1`) is the obvious choice for seeking, but it is expensive.
Measured seek latency at 1600×900, fully prefetched:

| GOP | size | median seek | p90 | max |
|---|---|---|---|---|
| `g=1` all-intra | 10.05 MB | 27 ms | 34.5 ms | 36.8 ms |
| **`g=6`** | **2.59 MB** | **24.1 ms** | 37.9 ms | 41.8 ms |
| `g=12` | 1.92 MB | 29.9 ms | 49.4 ms | 78.6 ms |

`g=6` seeks as fast as all-intra at a quarter of the bytes; `g=12` degrades the
tail. The saved budget went into resolution, a much lower CRF, and 24fps (one
frame per ~33px of scroll instead of ~65px).

### Tiers

| Device | First load | Then |
|---|---|---|
| Phone | `journey-sm` 960×540 · 1.6 MB | — |
| Tablet / desktop | `journey-lo` 1280×720 · 2.7 MB | **`journey` 1920×1080 · 8.2 MB, swapped in at the same frame** |

Scrubbing is immediate; the high-resolution cut arrives quietly a few seconds
later and replaces it without a visible change of position.

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

## Verified

- **120 checks** — 5 views × 8 widths (1920→375) × 3 languages: no horizontal
  overflow, no overlap, no console errors, no tap target under 30px
- **24 interaction tests** — loader, instant routing (0 document re-fetches),
  scroll-scrubbing, filter, sort, bag persistence, delivery-fee maths, order
  placement, advisor conversation, language switch + RTL, mobile menu
- **Scrub benchmark** — 0 stalls over a 90-step scroll, 54 seeks for 56 frame
  changes, HD tier confirmed swapping in at 1920×1080 on desktop and tablet
  while phones stay on the light cut
