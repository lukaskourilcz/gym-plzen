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

- The public header contains only the lotus symbol.
- Minimum digital size is 32 by 32 CSS pixels. The standard header size is 40.
- Clear space is at least one quarter of the symbol width on every side.
- Use the green symbol on light or ink surfaces. Do not place it on noisy
  photography without a solid backing surface.
- Do not rotate, stretch, recolour arbitrarily, or combine the symbol with an
  unrelated fitness icon.

### Full logo

- The full symbol and wordmark appears in the footer, authentication experience,
  admin shell, and brand documentation.
- Minimum width is 132 CSS pixels.
- Use the inverse wordmark on dark surfaces.
- A CMS logo may replace the code fallback only when it is approved full brand
  artwork with adequate contrast.

## Colour

All colours are semantic CSS variables in `src/app/globals.css`.

| Token         | Purpose                                   |
| ------------- | ----------------------------------------- |
| `background`  | Warm page background                      |
| `foreground`  | Primary copy                              |
| `card`        | Raised light surface                      |
| `primary`     | Main action and brand accent              |
| `accent`      | Selected and supportive green surface     |
| `secondary`   | Quiet section separation                  |
| `muted`       | Disabled or secondary surface             |
| `destructive` | Destructive action and blocking error     |
| `success`     | Confirmed state                           |
| `warning`     | Recoverable risk or attention state       |
| `info`        | Neutral operational information           |
| `ink`         | Hero, rules, footer, and admin navigation |

Never add a raw brand colour inside a component when a semantic token exists.
Dark surfaces use `ink` rather than one-off near-black values. Text opacity on
ink must preserve WCAG 2.2 AA contrast.

## Typography

- Family: Manrope, loaded through `next/font` with Latin and Latin Extended.
- Body: 16px on small screens, 16 to 18px for editorial introductions.
- Small metadata: never below 12px. Avoid long uppercase text.
- H1: 40 to 76px, weight 800, line height 0.98 to 1.05.
- H2: 30 to 48px, weight 800, line height 1.05 to 1.15.
- H3: 18 to 24px, weight 700 or 800.
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
- Use `--shadow-sm` for light elevation and `--shadow-md` for one prominent
  floating surface. Avoid stacked, glowing, or coloured shadows.

## Buttons and links

- Buttons are square or minimally rounded.
- Primary actions use `primary`; important dark-surface actions may use `ink`.
- Minimum target size is 44 by 44 CSS pixels.
- Use one primary action per decision area. Secondary actions use outline or
  ghost variants.
- Consistent Czech verbs are `Rezervovat`, `Pokračovat k platbě`, `Přihlásit
se`, and `Uložit`.
- Every control needs default, hover, focus-visible, active, pending, disabled,
  error, and success behaviour where applicable.
- Text links are underlined on hover and visibly focused.

## Icons

- Approved library: Lucide React plus the code-owned lotus mark.
- Default size is 16 or 20px. A prominent feature icon may use 24px.
- Keep the default Lucide stroke. Do not mix emoji, unrelated SVG packs, and
  Lucide in one interface.
- Icons supplement text. Icon-only controls require an accessible name and a
  44px target.

## Surfaces and cards

Cards group interactive or operationally related content. Do not turn every
paragraph into a card. Marketing sections should prefer editorial grids,
dividers, and media. Dark surfaces are limited to the hero, operating rules,
footer, and admin navigation shell.

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
  has a labelled toggle and restores focus when closed.

## Reservation calendar

The public booking flow is date first.

- The month heading and previous and next controls sit above a conventional
  seven-column Monday-first calendar.
- Dates outside the month are quiet and not bookable.
- Past and out-of-horizon dates are disabled with a screen-reader reason.
- Today has a visible `Dnes` cue. The selected date uses both a two-pixel border
  and text or an icon.
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
- Easing: `cubic-bezier(.2,.8,.2,1)`.
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
