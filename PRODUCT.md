# Bayaan.ai

## Register

**brand** — design IS the product on the marketing surface. The classroom app itself is product-register; this PRODUCT.md is for marketing pages first.

## Product purpose

Bayaan.ai is a real-time sermon and classroom translation platform. An imam (or teacher) speaks in Arabic on the minbar. The platform listens, transcribes the Arabic in real time, and delivers translation in 50+ languages to listeners on their phones. Sub-3-second latency. No headsets, no in-person interpreters, no waiting.

## Users

Two audiences land on this site:

1. **Mosque leaders / imams** in NL, BE, DE, FR — Arabic-speaking, often non-native to the country they preach in. They need their khutbah understood by a multilingual congregation (Dutch / French / German / English / Turkish / Urdu / Somali / etc.).
2. **Islamic teachers** running tafsir, dars, youth programs. Students span first-language Arabic speakers and second-generation Muslims who don't follow fusha at speed.

End-listeners (the people who scan the QR and join the room) don't visit this marketing site. They land directly on a /speech-s/[roomCode] link.

## Tone & voice

Calm, dignified, technical when it matters, warm when it doesn't. We respect the deen — the work is in service of dawah, never above it. No marketing hype. No "revolutionizing." No "AI-powered." We say what the product does and the listener understands.

Arabic phrases are sacred when used (Allah ﷻ, Quranic citation italics). They are NOT decoration — never use them as ornament.

## Anti-references

- The outdated live https://www.bayaan.ai (sparse, broken hero, 2024 mockup). NOT what we're building toward.
- Generic SaaS landing pages (gradient text headlines, three-card feature grids, testimonial carousels with stock photos).
- "Tech for mosques" projects that feel like crypto landing pages with a mosque skin.
- Glassmorphism, neon-on-black, animated emoji confetti, hero-metric "+50% efficiency" templates.
- Islamic-cliché reflexes: 8-pointed-star backgrounds, crescent moon icons, calligraphy as decorative texture, gold gradient text.

## Strategic principles

1. **Show, don't tell.** Above the fold, the user sees the actual student-view UI rendering an actual khutbah with actual translations dripping in. No marketing copy in the hero. They scroll for the words.
2. **The product surface is dark; the marketing surface is warm-light.** Marketing feels like daylight before walking into the room. The hero embeds the real product (dark) inside the warm marketing frame.
3. **Production fidelity over abstraction.** The hero student view imports the same CSS modules as the live `/speech-s` route. Visual changes to the real product propagate.
4. **Below-the-fold sections are utilitarian.** How it works (3 steps), Features (varied bento, not identical-card grid), Use cases (4 contexts), Pricing (3 honest tiers), CTA, Footer. They earn their place by being scannable.
5. **i18n-first.** EN, AR (RTL), NL primary. Arabic must look correct on its own — Noto Sans Arabic, proper RTL flow, no English-text-stuck-in-RTL-layout.

## Brand colors (committed strategy)

Warm cream surface (`oklch(0.97 0.01 90)`), deep emerald primary (`oklch(0.40 0.10 165)`) carries 30–60% of identity surface, gold accent (`oklch(0.78 0.12 80)`) used at <10%. Product preview frame stays dark (`oklch(0.16 0.015 200)`). Never `#000` / `#fff`. All neutrals tinted toward brand hue.

## Typography

Poppins (300–900) for Latin scripts, Noto Sans Arabic for Arabic. Arabic text uses italic styling for Quranic citations. Headline scale uses ≥1.25 ratio between steps.

## Where this lives

- Marketing pages: `app/page.tsx`, `app/(marketing)/...` (future), composed via `components/marketing/*`.
- Product app: `app/rooms/[roomName]`, `app/speech-{s,t}`, `app/v2/...` — the dark, live UI.
- Reference assets: `bayaan-landing/` (separate untracked Next.js project, source of `camera-preview.mp4` and design heritage).
