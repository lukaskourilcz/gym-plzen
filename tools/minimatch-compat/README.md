# Lint matcher compatibility

The October 2026 minimatch advisory is fixed in version 11. Older lint
dependencies still import the matcher as a callable CommonJS/default export.
This small bridge changes only that import shape and delegates matching to the
exact pinned `minimatch@11.0.3` engine. It does not contain an older matcher or
filter audit findings. Modern consumers (glob and the TypeScript parser) use
the upstream package directly.

Keep the bridge a development dependency. Remove it and the corresponding
override when the lint dependencies support the current import contract.
The compatibility test and full lint/build checks cover the APIs used by
this repository; the bridge does not restore APIs removed upstream in v11.

Advisories:

- https://github.com/advisories/GHSA-g3hv-75wg-m249
- https://github.com/advisories/GHSA-3g3m-2fjr-6pw4
