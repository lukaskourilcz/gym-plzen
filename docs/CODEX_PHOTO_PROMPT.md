# Kickoff prompt pro Codex — ilustrační fotografie

Zkopírujte celý blok níže do Codexu. Předpokládá přístup ke `lukaskourilcz/gym-plzen`.

---

Work in `lukaskourilcz/gym-plzen`. Branch from the latest `main` as
`codex/illustrative-photos`. Open a pull request at the end; do not push to
`main`. The whole point of this change is visual, so a human has to look at the
images before they go live.

**First, read `docs/PHOTO_PROMPTS.md` in the repo.** It contains twelve image
briefs — one per slot the site actually has — plus a shared opening paragraph
that pins the palette and the lens. Use those briefs verbatim as your
generation prompts: prepend the shared paragraph to each one. They are the
spec; do not rewrite them, and do not invent extra slots.

## What to produce

Generate twelve photographs and commit them to `public/images/photos/`:

| File                          | Brief in PHOTO_PROMPTS.md  | Aspect | Pixels    |
| ----------------------------- | -------------------------- | ------ | --------- |
| `hero.webp`                   | 1. Hlavní fotka v záhlaví  | 16:9   | 2560×1440 |
| `sections.webp`               | 2. Fotka za sekcemi        | 16:9   | 2560×1440 |
| `gallery-1.webp`              | 3. Hlavní dlaždice         | 4:5    | 1600×2000 |
| `gallery-2.webp`              | 4. Další pohled na prostor | 4:3    | 1600×1200 |
| `gallery-3.webp`              | 5. Detail tréninkové zóny  | 4:3    | 1600×1200 |
| `gallery-4.webp`              | 6. Zázemí a vstup          | 4:3    | 1600×1200 |
| `zone-1.webp` … `zone-6.webp` | 7.–12. Šest zón, in order  | 4:3    | 1600×1200 |

WebP, quality ~82. Target under 400 kB each, under 600 kB for `hero.webp`. If a
generator only emits PNG or JPEG, convert before committing — do not commit the
intermediate files.

## Code changes

The site currently points at a photograph on the client's old Wix site and
leaves most slots empty. Replace that with the committed files:

1. `src/app/page.tsx`
   - `PUBLISHED_GYM_PHOTO` (line ~45, a `static.wixstatic.com` URL) →
     `/images/photos/hero.webp`. It is used for both the hero and the first
     gallery tile; give the gallery tile `/images/photos/gallery-1.webp`
     instead, so the same picture is not shown twice on one page.
   - `SECTIONS_PHOTO` → `/images/photos/sections.webp`. Delete the now-unused
     `public/images/gym-interior.webp` (nothing else references it — check).
   - Gallery tiles 2–4 read `content.galleryImageUrls[index + 1]`, which is
     empty until an administrator uploads something. Add the committed files as
     the fallback, in the same `x || fallback` shape the hero already uses, so
     an administrator's upload still wins.
2. `src/app/vybaveni/page.tsx` — the `PHOTO` constant (line ~15) is the same Wix
   URL. Point it at `/images/photos/hero.webp`.
3. `src/app/vybaveni/page.tsx` — the six zone tiles read
   `content.zoneImageUrls[index]`. Add `zone-1.webp` … `zone-6.webp` as
   fallbacks, same shape, administrator's upload still wins.
4. Leave `next.config.ts` `remotePatterns` alone. An administrator may still
   paste a Wix or Supabase URL, and removing the pattern would break that.

## Hard constraints

- **The "Ilustrační foto" badge stays on.** `IllustrativePhoto` renders it while
  `content.illustrativePhotos` is true, and true is the default. These are
  generated pictures, not the real studio; a visitor must not be led to believe
  otherwise. Do not touch that flag, the component, or the badge.
- **No text, logos, signage or labels inside any image.** Generators add them
  unprompted — regenerate if one appears. An invented sign on a wall is a
  business fact this gym never claimed.
- **No people in the frames**, including the children's corner.
- Do not touch `navi-*.png` or `src/app/icon.png`. Those are the brand artwork
  and are already correct.
- Do not change any Czech copy, alt texts, prices, opening hours or contact
  details. This change is images and their wiring, nothing else.
- Do not add an image-hosting dependency or a CDN. These are static files.

## Before you open the PR

Run, from the repo root on Node 22:

```bash
npm ci
npm run format:check && npm run lint && npm run typecheck && npm test
npm run build
```

All must pass. Then look at the result, do not just trust the build:

```bash
PORT=3131 npm start
```

Check `/` and `/vybaveni` at 390, 768, 1280 and 1440 px wide. Confirm that the
hero headline is still legible over the new photograph (the left and centre of
`hero.webp` must stay quiet and darker — regenerate if the text fights the
image), that the "Ilustrační foto" badge appears on every photo, and that no
page scrolls sideways.

Never rebuild `.next` while a server is running — stop it first, or you will
get mixed artifacts and test results that mean nothing. See
`tests/e2e/README.md`.

## PR description

List the twelve files with their sizes, state the total added to the repo, and
say explicitly that the images are generated stand-ins and that the "Ilustrační
foto" badge remains on until the client supplies photographs of the real space.

## If you cannot generate images

Say so plainly and stop. Do **not** substitute stock photographs found online,
do not commit placeholders or solid-colour files, and do not point the code at
an external image host as a workaround. An empty slot already falls back to a
branded placeholder, which is honest; a wrong picture is not. In that case,
open no PR and report what you would need to proceed.
