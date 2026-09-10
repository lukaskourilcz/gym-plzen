# NAVI design system

This document is the canonical visual and interaction specification for the
NAVI Private Gym product. The live component reference is available to
administrators at `/admin/design-system`.

## Brand principles

The product should feel calm, serious, private, reliable, and premium without
feeling exclusive or intimidating. Operational clarity comes before decoration.
Strong hierarchy, exact time and price information, and restrained spacing
create trust.

Avoid a generic startup or AI-generated appearance. Do not use ornamental
gradients, glow, glass panels, decorative dashboards, excessive cards, inflated
marketing language, or an unnecessary call to action in every section.

## Logo system

### Brand mark

- `BrandMark` renders the client-supplied NAVI symbol: a kettlebell whose
  outline becomes the letter N. It is a supporting interface motif, not the
  primary lockup.
- The artwork ships as an alpha silhouette (`public/images/navi-mark.png`) and
  is drawn as a CSS mask tinted with `currentColor`. The supplied logo is gold,
  which sits at roughly 1.9:1 on the cream background, so the surface picks the
  treatment: `accent-foreground` green on light, `gold` on ink (7:1). Never
  place gold artwork on a light surface.
- The browser icon is `src/app/icon.png`, the same silhouette in `gold` on
  `ink`. Do not redraw or approximate the symbol for favicons.
- Minimum digital size is 32 by 32 CSS pixels. Clear space is at least one
  quarter of the symbol width on every side.
- Pass `decorative` when adjacent text already names the brand, so the symbol
  is hidden from assistive technology instead of announcing a second name.
- Do not rotate, stretch, recolour beyond the two documented treatments, or
  combine the symbol with an unrelated fitness icon. The FAQ toggle may
  crossfade and scale between the mark and an accessible question mark to
  communicate open state.

### Full logo

- `BrandLogo` is the navigation lockup: the symbol left, the `NAVI` wordmark
  with its `PRIVATE GYM` descriptor right, both masks so the pair takes one
  colour. About 150 CSS pixels wide in the public header; the admin shell uses
  the compact variant in gold on its ink rail. Below 380 CSS pixels the wordmark
  is hidden and the symbol carries the brand alone, because the header also
  holds a permanent booking button there.
- `BrandLockup` renders the full stacked artwork at 150 CSS pixels in the footer
  and larger on authentication surfaces, in gold on those ink surfaces. Size it
  through the wrapper (`className="w-56"`), which the inner artwork fills.
- Keep the aspect ratio, clear space and full wordmark. Do not rebuild it with
  another font or replace it with the supporting `BrandMark`.

### Asset provenance

The current PNGs are silhouettes extracted from the client's 3D brand
visualisation (`public/images/navi-logo-source.png`), which is the only artwork
supplied so far. They are faithful in shape but carry the render's soft edges.
When the client delivers vectors, replace `navi-mark.png`, `navi-wordmark.png`,
`navi-logo.png` and the flat-colour `navi-logo-email.png` (e-mail clients ignore
CSS masks) and regenerate `src/app/icon.png`; no component changes are needed.

## Design variants

The public site ships two looks: `classic`, the approved appearance, and
`modern`, a bolder editorial reading of the same brand. The choice is a preview
aid for comparing them with the client, not a user preference: once `modern` is
approved it becomes the default and the switch is removed.

- The variant lives in the `ns_design` cookie and is stamped on `<html>` as
  `data-design` by a small inline script in the root layout, before first paint.
- Rendered HTML is identical for both variants. The homepage is ISR
  (`revalidate = 60`), so nothing may read the cookie on the server for a public
  page; doing so would silently turn the route dynamic.
- Every difference is expressed by redefining the variant tokens below inside
  the single `[data-design="modern"]` block in `globals.css`. Components consume
  them through arbitrary values such as `text-[length:var(--display-1)]`. Do not
  add colours, gradients, shadows, or component variants for `modern`, and do not
  branch the DOM: where two presentations are genuinely different shapes, render
  both and let CSS reveal one, keeping the hidden one out of the accessibility
  tree with `display: none`.

| Token                | Classic           | Modern     | Purpose                       |
| -------------------- | ----------------- | ---------- | ----------------------------- |
| `--display-1`        | Tailwind 36/48/60 | 40 to 72px | H1 display size               |
| `--display-2`        | Tailwind 30/36    | 32 to 48px | H2 display size               |
| `--section-space`    | 80px              | 88px       | Section rhythm, small screens |
| `--section-space-lg` | 96px              | 120px      | Section rhythm, from `sm` up  |
| `--eyebrow-rule`     | 0px               | 2px        | Rule under a section eyebrow  |
| `--header-lift`      | 0px               | 24px       | Extra hero breathing room     |

Spacing tokens are consumed by `Section` in both variants, and their classic
values are exactly the approved `py-20 sm:py-24`. The display tokens apply only
under `[data-design="modern"]`, so classic typography keeps the stepped Tailwind
sizes it was approved with and cannot drift.

Markup opts in through `data-*` hooks, never through variant-specific classes:
`data-display="1" | "2"` for display headings, `data-hero` for the hero padding,
`data-eyebrow` for the rule, `data-fact-value` for the homepage figures,
`data-zone="ink"` with `data-zone-title` for the equipment tiles, and
`data-cta-arrow` for the 140ms hover shift. `data-scrolled` on the header drives
a firmer bottom edge once the page moves.

Two constraints the modern rules must keep:

- **Gold is an ink-only accent.** The eyebrow rule uses `currentColor` and the
  fact figures keep `foreground`, because gold on the cream background is about
  1.9:1. Gold titles appear only on the ink equipment tiles, where they clear
  7:1.
- **The header height never changes.** `--header-h` is the single source of truth
  for anchor scroll offsets and the hero's reserved height, so the scrolled state
  changes the border and elevation only.

The loyalty widget is the reference for a genuinely different shape: the account
page renders both the classic segment bar (`data-loyalty="segments"`) and the
modern gold ring (`data-loyalty="ring"`), and CSS reveals one. Both are
decorative and hidden from assistive technology, because the sentence above them
already states the exact progress; both read their fill from the same
`loyaltyFilledSegments` rule, so they cannot disagree.

The switch is internal tooling and lives on `/dev` alone : it is rendered on
that page and nowhere else, so no visitor can meet it at any width, in the
header or in the mobile menu. That is a structural guarantee rather than a CSS
rule, which is what a change in specificity or a stray utility could otherwise
defeat; a unit test asserts the header does not import the control.

Choosing a look there writes the `ns_design` cookie, and the pre-paint inline
script stamps `data-design` on `<html>`, which is what carries the variant
across the rest of the site. Keeping the choice in a cookie read on the client,
rather than on the server, is what lets the public pages stay ISR. `/dev` is
`noindex` and excluded from both the sitemap and `robots.txt`.

The control is a native radio group, so arrow keys work and the group has one
accessible name. The administration does not use variants.

## Colour

The client-approved palette is deep green `#004534` with ink `#003527`, gold
`#ddb255`, taupe `#7c6650`, and charcoal `#2e2e2e`. All colours are semantic
CSS variables in `src/app/globals.css`.

| Token               | Purpose                                           |
| ------------------- | ------------------------------------------------- |
| `background`        | Warm page background                              |
| `foreground`        | Primary copy                                      |
| `card`              | Raised light surface                              |
| `primary`           | Deep brand green: main action, white label        |
| `accent`            | Selected and supportive green surface             |
| `accent-foreground` | Accessible green copy and icons on light surfaces |
| `gold`              | The only accent that reads on ink and charcoal    |
| `charcoal`          | Deliberately neutral dark panels                  |
| `sage`              | Editorial band behind the operating steps         |
| `sage-soft`         | Card surface inside a sage band                   |
| `sage-foreground`   | Copy on sage surfaces                             |
| `taupe`             | Warm neutral surface, white copy only             |
| `secondary`         | Quiet section separation                          |
| `muted`             | Disabled or secondary surface                     |
| `destructive`       | Destructive action and blocking error             |
| `success`           | Confirmed state                                   |
| `warning`           | Recoverable risk or attention state               |
| `info`              | Neutral operational information                   |
| `ink`               | Hero, pricing, call to action, footer, admin nav  |

Never add a raw brand colour inside a component when a semantic token exists.
Use `accent-foreground` for green text and icons on light surfaces. `primary`
and `ink` are both deep green, so on an ink surface an accent must be `gold`:
never `primary`, which would disappear. Dark surfaces use `ink` or `charcoal`
rather than one-off near-black values. Text opacity on ink must preserve WCAG
2.2 AA contrast; keep body copy at 75 percent or higher.

The current hero photograph carries a 60 percent ink veil so more of the room
remains visible. Recheck that white copy stays above 4.5:1 whenever the image is
replaced or its art direction changes.

The operating-steps and pricing bands share one pinned photograph behind an
`ink/60` veil, matching the hero: the image lives in an `absolute inset-0` track and is
`sticky top-0 h-svh` inside it, so it holds still while both bands scroll over
it. That track must not carry `overflow-hidden`, which would make it the
scrollport and stop the child pinning. Prefer this over
`background-attachment: fixed`, which breaks on iOS Safari and cannot use
`next/image`. The photograph is admin-configurable through
`branding.sections_image_url`.

## Typography

- Family: Bitter, served through the application with its `latin-ext` subset
  so Czech diacritics and metrics are consistent on iPhone, Android and desktop.
- Body: 16px on small screens, 16 to 18px for editorial introductions.
- Small metadata: never below 12px. Reserve uppercase for section eyebrows,
  card titles, and the booking action.
- H1: 36 to 60px, weight 800, line height 1.05 to 1.15.
- H2: 30 to 48px, weight 800, line height 1.1 to 1.2.
- H3: 18 to 24px, weight 700 or 800.
- Tracking stays near neutral. A slab serif already has wide letterforms, so do
  not reuse the tight negative tracking a grotesque needs; `-0.01em` is the
  practical floor for display sizes.
- Body line height: 1.5 to 1.7. Keep readable lines near 60 to 72 characters.
- Czech accents must render correctly. Never remove accents to fit a layout.

Heading order follows document structure. A page has one H1. Section titles are
H2 and card titles beneath them are H3.

## Layout, spacing, and breakpoints

- Base spacing unit: 4px.
- Preferred gaps: 8, 12, 16, 24, 32, 48, 64, and 96px.
- Public container: maximum 1200px with 20px mobile and 24px larger padding.
- Editorial reading width: 640 to 720px.
- Section spacing: 72px mobile and 96px desktop, unless a relationship requires
  tighter grouping.
- Use grid for page structure and flexbox for one-dimensional alignment.
- The root document is a minimum-height column. A direct `main` expands to fill
  unused viewport space, so every public footer rests at the viewport bottom on
  short pages and follows the content normally on longer pages.

Primary breakpoints follow Tailwind defaults. Verify every public layout at 320,
390, 667 landscape, 768, 1024, 1280, 1440, and a wide desktop. Introduce a
content-driven breakpoint when the default breakpoints cause a collision: the
public header does exactly that at 380px, where the full brand lockup, the
permanent booking button and the menu toggle stop fitting on one row.

## Borders, radii, and shadows

- Controls use `radius-md`, currently 4px.
- Cards use `radius-lg`, currently 10px.
- Large media may use 12px. Do not add arbitrary 18 to 28px radii.
- Pills are reserved for a compact status with a strong semantic need. Badges
  use a small radius, not a capsule.
- Standard borders are one pixel. Selected controls may use two pixels when it
  prevents a colour-only distinction.
- Use `shadow-sm` for light elevation and `shadow-md` for one prominent floating
  surface. Those two utilities are remapped onto the `--elevation-*` tokens, so
  they are the whole scale: `shadow-lg` and `shadow-2xl` are not part of the
  system. Avoid stacked, glowing, or coloured shadows.

## Buttons and links

- Buttons are square or minimally rounded.
- Primary actions use `primary`; important dark-surface actions may use `ink`.
- Minimum target size is 44 by 44 CSS pixels. Two exceptions: a stacked footer
  link list uses compact 36px rows on touch and drops to 28px from `lg` up
  (both remain past the WCAG 2.2 AA 24px floor), and a link set inside a running
  sentence keeps its line height, which WCAG 2.5.8 exempts.
- Use one primary action per decision area. Secondary actions use outline or
  ghost variants. The persistent header booking button is the single documented
  exception: it is a global navigation action rather than part of any one
  decision area, so it may render as `primary` alongside a section's own primary
  action. It is the only booking primary in the header region: the mobile menu
  below it must not repeat the same action as a second `primary`.
- An outline button on a dark surface needs its border at 3:1 or better against
  that surface, because the border is the only thing identifying the control.
  `border-white/45` is the floor on `ink`.
- Focus is drawn once, globally, by the `:focus-visible` outline in
  `globals.css`, tuned to clear 3:1 on both the cream background and `ink`. A
  component may only add `focus-visible:outline-none` if it supplies its own
  indicator, and that indicator must suit the surface: `ring-ring` on light,
  `ring-gold` on `ink`.
- Consistent Czech verbs are `Rezervovat`, `Pokračovat k platbě`, `Přihlásit
se`, and `Uložit`.
- Every control needs default, hover, focus-visible, active, pending, disabled,
  error, and success behaviour where applicable.
- Text links are underlined on hover and visibly focused.

## Icons

- Approved library: Lucide React plus the client-supplied NAVI mark. Lucide no
  longer ships brand icons, so Facebook, Instagram and WhatsApp use code-owned
  official filled silhouettes in `components/site/social-icons.tsx`. Do not add
  a third-party brand icon pack.
- In the footer these glyphs sit in `gold` on subtle circular outlines and fill
  with gold on hover, comfortably preserving the non-text contrast floor. On
  mobile the footer links form a 2×2 grid, with social links in the lower-right
  cell beside the Information links; larger screens keep socials under them.
  Facebook and Instagram render from their content links. WhatsApp derives a
  `wa.me` link exclusively from the primary public contact phone, so its glyph
  stays in sync when the operator changes that number; the secondary phone is
  call-only. The confirmed Facebook and Instagram profile URLs are the public
  defaults; the Facebook resolver also replaces the old seeded placeholder.
- Default size is 16 or 20px. A prominent feature icon may use 24px.
- Keep the default Lucide stroke. Do not mix emoji, unrelated SVG packs, and
  Lucide in one interface.
- Icons supplement text. Icon-only controls require an accessible name and a
  44px target.

## Surfaces and cards

Cards group interactive or operationally related content. Do not turn every
paragraph into a card. Marketing sections should prefer editorial grids,
dividers, and media. Dark surfaces are limited to the hero, the pricing band,
the closing call to action, the equipment zone tiles, the footer, and the admin
navigation shell.

Three sanctioned homepage patterns exist because the content is genuinely
parallel or transactional:

- **Operating steps** (homepage): one hairline-separated grid of white `card`
  panels over the pinned photograph. Every panel uses the same fixed left
  number column, followed by a left-aligned uppercase title and body copy. On
  desktop the badges align vertically within each of the grid's three columns;
  the grid collapses to two and then one column on narrower screens.
- **Price card** (homepage): the price is always on a white `card` surface
  inside the dark photo band. The label, amount and duration are centered; the
  single reservation action spans the card width. The card stretches to the
  height of the copy column beside it, so the band reads as one block rather
  than a short card floating against a tall column.
- **Fact strip** (homepage): four equal centered cells with hairlines between
  them and on both outside edges. On desktop the hero reserves enough height
  for the strip to be visible in the initial viewport.
- **Zone tiles** (`/vybaveni`): a two-column grid alternating `ink` and
  `sage-soft`, each tile split into a copy half and a media half. The media half
  carries the decorative brand mark until the operator supplies a zone photograph.

`sage` is a large-text-only surface. `sage-foreground` on it is 4.56:1, which
clears AA for body copy by a hair; never put anything smaller than a section
heading on it. Use `sage-soft` (8.03:1) for anything readable.

`charcoal` and `ink` are close to identical in luminance and differ mainly in
hue. Any charcoal panel on an ink band therefore needs a non-hue cue, such as a
`border-gold/40` hairline.

The closing homepage call to action is one horizontal band from `lg`: its
heading stays on one line at desktop widths, with one reservation button right.
The contact block above the map is a single
left-aligned stack under its heading: confirmed public address, e-mail and
telephone, without card borders or vertical dividers. The map itself carries a
white address overlay so the location remains readable before and after the map
loads. The gold brand mark is an Advanced Marker positioned at the verified entrance
coordinates inside Google Maps, so it remains fixed to the address while the
visitor zooms or pans. Never draw it as an overlay above an iframe: an overlay
only lines up at the initial view and then drifts. When the Maps JavaScript API
is unavailable, the coordinate-query embed remains as a fallback and supplies
Google's standard anchored pin.

Display headings may be set as stacked short lines with the final line in
`gold`, the pattern the hero establishes. Reserve it for the hero and the
pricing band; it loses its force if every section shouts.

## Forms

- Every field has a persistent programmatic label.
- Inputs are at least 44px high and use 16px text on mobile.
- Field errors appear next to the relevant field and are wired to the control
  with `aria-describedby` and `aria-invalid`. The shared `Field` wrapper does
  this for whatever control it is given, because React Hook Form focuses the
  first invalid field on submit and an unannounced landing there is silence.
- Top-level errors use the notice component with `role="alert"`.
- A combined consent checkbox may name multiple linked documents in one
  sentence. Keep every document link outside the plain-text `label`, because a
  `label` may not contain an interactive element. Put the full sentence in an
  `aria-labelledby` container so it remains the checkbox's accessible name.
  The checkbox itself is styled through `accent-color` only; border and radius
  utilities are inert on a native control and should not be written as though
  they applied.
- Pending submission prevents repeats and retains the original verb.
- Do not expose raw provider errors or reveal whether an account exists.

## Notices, badges, dialogs, tables, and navigation

- Notices use `info`, `success`, `warning`, or `error`, an icon, and text.
  Colour is never the only signal.
- Badges communicate compact status only. Translate backend enum values before
  showing them to customers.
- Dialogs require a title, focus trap, Escape close, focus return, and a clear
  destructive-action distinction.
- Tables keep headers visible and become readable stacked summaries or a
  horizontally contained region on small screens. The page must not overflow.
- Navigation exposes the current route with `aria-current`. Mobile navigation
  has a labelled toggle, closes with Escape and restores focus when closed.
- The first focusable control is a native skip link to the route-level `main`.
  Each resolved route owns exactly one focusable `main-content` target after
  repeated navigation. The streaming loading landmark deliberately omits the id
  so the DOM never contains duplicate targets.
- Mobile administration uses one labelled grouped menu instead of a long
  horizontally scrolling list. Its active item stays visible and announced.

## Reservation calendar

The public booking flow is date first.

- The month heading and previous and next controls sit above a conventional
  seven-column Monday-first calendar.
- Dates outside the month are quiet and not bookable.
- Past and out-of-horizon dates are disabled with a screen-reader reason.
- Today has a distinct border and surface plus `aria-current="date"`. The
  selected date uses a high-contrast surface, border, and `aria-selected`.
- Availability uses text or a dot plus an accessible label. Colour alone is
  insufficient.
- Arrow keys move by day or week, Home and End move within the week, Page Up and
  Page Down change month, and Enter or Space selects a date.
- Slots render only after date selection and show exact start and end, duration,
  and price.
- Available, selected, unavailable, past, loading, empty, closed, and
  service-unavailable states are distinct.
- Async availability changes use a polite live region. Blocking errors preserve
  the selected date.

## Photography

- Use only verified client photography. Do not generate or source a fake gym.
- One documented exception, while the client has no photographs of their own:
  stock stand-ins may be used if every one carries a visible "Ilustrační foto"
  label (`IllustrativePhoto`, driven by `branding.illustrative_photos`) and its
  alt text does not claim to show the gym. The operator turns the label off once
  their own photographs replace them.
- Hero art direction uses a wide real-space view, restrained contrast, and room
  for copy. Prefer a 16:10 desktop crop and 4:5 mobile crop.
- Use `next/image`, explicit `sizes`, responsive aspect ratios, descriptive alt,
  and priority only for the genuine above-the-fold image.
- Gallery images need useful alt text. Decorative images use an empty alt.
- When an image is unavailable, use a structural placeholder that does not imply
  it is a photograph of the gym.

## Motion

- Standard duration: 140ms for controls and 220ms for panels.
- Easing: `cubic-bezier(.2,.8,.2,1)`, exposed as the `ease-brand` utility. Use
  the token rather than repeating the literal.
- One exception: the FAQ brand mark crossfades into a question mark when a question
  opens. It runs at 220ms with a restrained scale transition, a gentle
  overshoot reserved for this single brand mark. Do not reuse that easing for
  ordinary controls, and do not add a third easing token.
- Motion explains state changes; it is not decoration.
- Skeletons mirror the final route geometry and use one slow, low-contrast
  pulse. Never substitute a generic large rectangle for structured content.
- Honour `prefers-reduced-motion`. Information must not depend on animation.

## Accessibility

- WCAG 2.2 AA is the minimum target.
- Body and control text must meet 4.5:1, large text 3:1, and focus indicators
  and component boundaries 3:1 against adjacent colours.
- Focus is visible on every interactive element.
- Maintain landmarks, meaningful headings, skip navigation, accessible names,
  44px targets, reduced motion, and logical focus after dynamic updates.
- Verify keyboard-only use, 200% zoom, and representative screen-reader output.

## Prohibited patterns

- Excessive pill buttons, randomly rounded containers, glassmorphism, glow,
  gratuitous gradients, decorative blobs, or dashboard-style marketing grids.
- Multiple competing primary actions in one viewport.
- Unverified opening hours, equipment, capacity, policies, reviews, guarantees,
  or live availability.
- Em dashes in customer copy when a full stop, comma, colon, or parenthesis is
  clearer.
- Generic claims such as revolutionary, seamless, next-generation, unique
  experience, or tailored solution without evidence.
- Raw provider errors, technical identifiers, PII, access codes, or secrets in
  public UI and logs.

## Change governance

Before adding a reusable visual pattern, search the shared components and this
document. If a new pattern is justified, add its semantic token or component,
document it here, and add it to `/admin/design-system` in the same change. Run
the reviewer in `.claude/agents/design-system-reviewer.md` for every non-trivial
UI implementation.

## Customer avatar

`CustomerAvatar` uses an 80px circular `accent` surface with accessible
`accent-foreground` initials. The circle is reserved for personal identity,
not controls. A verified Google HTTPS image is optional; initials appear when
the image is missing or fails. The wrapper has an image role and name, while
its children are decorative. Selection uses labelled native radios in the
customer profile. The rendered example is in `/admin/design-system`.
