# NAMASTE design system

This document is the canonical visual and interaction specification for the
NAMASTE Private Gym product. The live component reference is available to
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

### Lotus symbol

- Minimum digital size is 32 by 32 CSS pixels. The standard header size is 40.
- Clear space is at least one quarter of the symbol width on every side.
- Use `accent-foreground` green on light surfaces and `gold` on ink surfaces.
  Do not place it on noisy photography without a solid backing surface.
- Pass `decorative` when adjacent text already names the brand, so the symbol
  is hidden from assistive technology instead of announcing a second name.
- Do not rotate, stretch, recolour arbitrarily, or combine the symbol with an
  unrelated fitness icon. The FAQ toggle rotation is the one sanctioned motion
  and it only communicates open state.

### Full logo

- `BrandLogo` is the horizontal lockup: symbol beside the wordmark. It appears
  in the public header, the admin shell, and brand documentation.
- `BrandLockup` is the stacked lockup: symbol above the wordmark above the
  `PRIVATE GYM` descriptor. It leads the footer and any surface where the brand
  is the primary element rather than a navigation item.
- Minimum width is 132 CSS pixels.
- Use the inverse wordmark on dark surfaces.
- A CMS logo may replace the code fallback only when it is approved full brand
  artwork with adequate contrast.

## Colour

The brand palette is deep green, gold, charcoal, and taupe. All colours are
semantic CSS variables in `src/app/globals.css`.

| Token               | Purpose                                           |
| ------------------- | ------------------------------------------------- |
| `background`        | Warm page background                              |
| `foreground`        | Primary copy                                      |
| `card`              | Raised light surface                              |
| `primary`           | Deep brand green: main action, white label        |
| `accent`            | Selected and supportive green surface             |
| `accent-foreground` | Accessible green copy and icons on light surfaces |
| `gold`              | The only accent that reads on ink and charcoal    |
| `charcoal`          | Price card and other deliberately neutral panels  |
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

A hero photograph carries a solid ink veil so white copy stays above 4.5:1 on
any frame of the image. Do not lighten the veil below 78 percent.

## Typography

- Family: Bitter, loaded through `next/font` with Latin and Latin Extended.
  It is a slab serif and it is the only family in the product.
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

Primary breakpoints follow Tailwind defaults. Verify every public layout at 320,
390, 768, 1024, 1280, 1440, and a wide desktop. Introduce a content-driven
breakpoint when the default breakpoints cause a collision.

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
- Minimum target size is 44 by 44 CSS pixels.
- Use one primary action per decision area. Secondary actions use outline or
  ghost variants. The persistent header booking button is the single documented
  exception: it is a global navigation action rather than part of any one
  decision area, so it may render as `primary` alongside a section's own primary
  action.
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

- Approved library: Lucide React plus the code-owned lotus mark. Lucide no
  longer ships brand icons, so Facebook and Instagram are code-owned glyphs in
  `components/site/social-icons.tsx`, drawn on the same 24px grid with the same
  2px round stroke. Do not add a third-party brand icon pack.
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

Two sanctioned grids exist, both because the content is genuinely a set of
parallel items rather than prose:

- **Operating steps** (homepage): a `sage` band holding `sage-soft` cards, one
  per step, with an uppercase centred title.
- **Zone tiles** (`/vybaveni`): a two-column grid alternating `ink` and
  `sage-soft`, each tile split into a copy half and a media half. The media half
  carries a decorative lotus until the operator supplies a zone photograph.

`sage` is a large-text-only surface. `sage-foreground` on it is 4.56:1, which
clears AA for body copy by a hair; never put anything smaller than a section
heading on it. Use `sage-soft` (8.03:1) for anything readable.

`charcoal` and `ink` are close to identical in luminance and differ mainly in
hue, so a charcoal panel on an ink band needs a non-hue cue: give it a
`border-gold/40` hairline rather than relying on the colour change alone.

## Forms

- Every field has a persistent programmatic label.
- Inputs are at least 44px high and use 16px text on mobile.
- Field errors appear next to the relevant field and use `aria-describedby` and
  `aria-invalid` where possible.
- Top-level errors use the notice component with `role="alert"`.
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
- Motion explains state changes; it is not decoration.
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
