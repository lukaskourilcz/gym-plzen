import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const load = createRequire(import.meta.url);

test("legacy lint imports use the patched matcher through callable CommonJS and ESM defaults", async () => {
  const legacy = load("minimatch");
  const engine = load("minimatch-engine");
  const esm = await import(
    new URL("../../tools/minimatch-compat/index.mjs", import.meta.url).href
  );
  assert.equal(legacy, engine.minimatch);
  assert.equal(esm.default, esm.minimatch);
  assert.equal(typeof esm.Minimatch, "function");
  assert.equal(legacy.Minimatch, engine.Minimatch);
  assert.equal(legacy("src/app/page.tsx", "**/*.{ts,tsx}"), true);
  assert.equal(legacy("src/app/page.tsx", "**/*.js"), false);
  assert.equal(legacy(".next/cache/file.js", "**/*.js"), false);
  assert.equal(legacy(".next/cache/file.js", "**/*.js", { dot: true }), true);
  assert.equal(
    legacy("src/app/page.tsx", "page.tsx", { matchBase: true }),
    true,
  );
  assert.equal(legacy("#page", "#page", { nocomment: true }), true);
  assert.equal(
    new legacy.Minimatch("**/*.tsx").match("src/app/page.tsx"),
    true,
  );
  assert.deepEqual(legacy.match(["page.tsx", "page.js"], "*.tsx"), [
    "page.tsx",
  ]);
  assert.equal(
    legacy.defaults({ dot: true })(".next/file.js", "**/*.js"),
    true,
  );
  assert.equal(esm.default("src/app/page.tsx", "**/*.{ts,tsx}"), true);
  assert.equal(new esm.Minimatch("**/*.tsx").match("src/app/page.tsx"), true);
});
