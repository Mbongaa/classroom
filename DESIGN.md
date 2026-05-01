# Bayaan.ai design tokens

All marketing tokens scoped under `[data-mkt-root]` in `styles/globals.css`. Don't leak into product UI (which uses LiveKit's `--lk-*` and `[data-lk-theme="default"]`).

## Colors (OKLCH, never hex)

### Light marketing (default)

```
--mkt-bg          oklch(0.97 0.01 90)     /* warm ivory */
--mkt-bg-elev     oklch(0.99 0.005 90)
--mkt-bg-sunken   oklch(0.93 0.012 85)
--mkt-fg          oklch(0.22 0.012 200)   /* deep slate */
--mkt-fg-muted    oklch(0.46 0.015 200)
--mkt-fg-subtle   oklch(0.62 0.012 200)
--mkt-brand       oklch(0.40 0.10 165)    /* deep emerald */
--mkt-brand-deep  oklch(0.30 0.09 170)
--mkt-brand-soft  oklch(0.92 0.04 165)
--mkt-accent      oklch(0.78 0.12 80)     /* gold */
--mkt-accent-deep oklch(0.66 0.13 75)
--mkt-border      oklch(0.88 0.012 90)
--mkt-border-strong oklch(0.78 0.015 90)
--mkt-success     oklch(0.62 0.13 155)
```

### Product preview frame (always dark inside the marketing surface)

```
--mkt-preview-bg        oklch(0.16 0.015 200)
--mkt-preview-elev      oklch(0.21 0.018 200)
--mkt-preview-fg        oklch(0.96 0.005 200)
--mkt-preview-fg-muted  oklch(0.72 0.012 200)
--mkt-preview-border    oklch(0.30 0.020 200)
--mkt-preview-brand     oklch(0.62 0.13 165)
```

### Dark variant (`.dark [data-mkt-root]`)

```
--mkt-bg          oklch(0.16 0.015 200)
--mkt-fg          oklch(0.96 0.005 200)
--mkt-brand       oklch(0.62 0.13 165)   /* lifted for contrast */
--mkt-accent      oklch(0.82 0.13 80)
```

Color strategy: **Committed**. Emerald carries 30–60% of identity surface; gold is reserved (<10%) for purposeful accents (CTAs, eyebrow dots, latest-card indicator). Cream + slate are the structural neutrals.

## Typography

- Family: Poppins (Latin), Noto Sans Arabic (Arabic). Loaded via Next/Font in `app/layout.tsx`.
- `--font-poppins` is set on `<html>` and inherited via `[data-mkt-root] { font-family: var(--font-poppins) ... }`.
- Scale (utility classes in globals.css):
  - `.mkt-h1` — `clamp(2.5rem, 6vw, 4.5rem)` / 700 / -0.025em / 1.04
  - `.mkt-h2` — `clamp(1.875rem, 4vw, 3rem)` / 700 / -0.02em / 1.10
  - `.mkt-h3` — `clamp(1.25rem, 2vw, 1.5rem)` / 600 / -0.01em / 1.25
  - `.mkt-lead` — `clamp(1.0625rem, 1.4vw, 1.25rem)` / 1.55 line-height / max 38rem
- Scale ratio: ≥1.5 between h1/h2/h3; not flat.

## Layout

- Container: `.mkt-container` — `max-width: 1200px`, padding scales 1.25rem → 2rem → 3rem at md/xl. Used for non-hero sections only; hero is full-bleed.
- Section vertical rhythm: `.mkt-section` — `padding-block: clamp(4rem, 9vw, 7rem)`. Don't use this on the hero.
- Card: `.mkt-card` — 16px radius, 1px border, hover lifts 2px + border darkens. NEVER nested.

## Surface elevation

Three levels:
- `--mkt-bg` (page surface, lightest)
- `--mkt-bg-elev` (cards, panels)
- `--mkt-bg-sunken` (alt sections like Features, Pricing, Footer)

Shadow recipe for product preview frame:
```
0 1px 1px oklch(0.20 0.02 200 / 0.04),
0 12px 32px oklch(0.20 0.02 200 / 0.10),
0 40px 100px oklch(0.20 0.02 200 / 0.18)
```

## Motion

- Use `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quart). Never bounce, never elastic.
- Pulse keyframe `mkt-pulse` for live indicators (2.4s, transform-only).
- Translation card entry: `mkt-fade-up` 360ms ease-out-quart.
- Speaking ring: `mkt-speaking-pulse` 1.6s, transform-only.
- NEVER animate `width`, `height`, `top`, `left`, or `padding`. Compose with transform / opacity only.

## Iconography

`lucide-react` only. Sizes: 14 (badges), 16 (controls), 18 (tile chrome), 20 (feature cards), 22 (hero feature card).

## Component decisions

- **Hero**: full viewport (`min-height: calc(100svh - 64px)`), edge-to-edge. Renders `<MarketingStudentView fillParent />` which wraps the actual `/speech-s` student view chrome (same CSS module, same DOM shape) but driven by `camera-preview.mp4` + scripted translation segments synced to `video.currentTime`.
- **Marketing nav**: 64px sticky, transparent until scroll, then cream + 1px bottom border. Theme toggle in top-right (same `<ThemeToggleButton>` used in the product).
- **Sections below hero**: How it works (3 numbered steps), Trust strip (cities), Features (asymmetric bento, NOT identical-card grid), Use cases (4 cards, first one inverse-emerald), Pricing (3 tiers, middle highlighted), CTA (drenched emerald block), Footer.

## Anti-patterns enforced

- No gradient text (`bg-clip-text` + gradient bg).
- No side-stripe borders >1px on cards.
- No glassmorphism by default. Selective use only on the live video badge.
- No identical-card grids (Features uses asymmetric bento).
- No hero-metric template (big number + label).
- No nested cards.
- No em dashes in copy.
- No `#000` or `#fff` anywhere.
