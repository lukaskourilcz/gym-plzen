# BoardUI in NAVI administration

Button, Chip, Divider and the class-merging helper are installed as source from
BoardUI's public registry. `sources.json` records the URLs and original content
hashes; `LICENSE` preserves the upstream MIT notice.

Upstream component files keep their behavior and change local import paths and use the repository formatter.
The directional icon helper uses NAVI's Lucide icons. `tokens.css` registers semantic BoardUI utility names through the application
Tailwind entry point and maps them to existing NAVI tokens; it does not install BoardUI's
global reset, palette, typography or application templates.

Administration adapters live in `../ui`. Native inputs, selects and tables keep
React Hook Form registration, browser validation, server rendering and existing
GET filters. The Button adapter explicitly preserves native implicit submit
behavior and Next.js navigation. This avoids replacing working form and table
contracts with React Aria collection components during a visual change.

All visual overrides are scoped to `.admin-shell`. Public pages and the public
website canvases embedded in the CMS retain their existing design.
