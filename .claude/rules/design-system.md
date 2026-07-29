# Design-system rule

`docs/DESIGN_SYSTEM.md` is the canonical source for the NAMASTE visual system.

For every non-trivial UI change:

1. Read the canonical document and inspect `/admin/design-system`.
2. Reuse semantic CSS tokens and shared components.
3. Do not introduce arbitrary colours, typography, icon packs, spacing, radii,
   shadows, gradients, or control variants.
4. Keep buttons square or minimally rounded and targets at least 44px.
5. Use Bitter with Czech and Latin Extended support and Lucide icons.
6. Preserve the documented route to service to data or integration architecture.
7. Verify 320, 390, 667 landscape, 768, 1024, 1280, 1440, and 1728px layouts.
8. Verify keyboard navigation, focus visibility, WCAG 2.2 AA contrast, semantic
   names, 200% zoom, and reduced motion.
9. Update both `docs/DESIGN_SYSTEM.md` and `/admin/design-system` when adding a
   legitimate reusable pattern.
10. Run the design-system reviewer before completing the change.
