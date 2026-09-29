import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

/**
 * Structural guard, deliberately a source scan rather than a behavioural test.
 *
 * `src/app/admin/layout.tsx` calls `requireAdmin()`, but a layout is not a
 * security boundary in the App Router: a crafted RSC request can render a page
 * segment without re-rendering its layout. Every admin page and route handler
 * therefore authorises itself. Rendering each page under a fake session would
 * need the whole Next runtime, so this test only proves the call is present;
 * `requireAdmin` itself is what enforces the role.
 */
const ADMIN_DIR = "src/app/admin";

async function listEntryFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listEntryFiles(full)));
    else if (entry.name === "page.tsx" || entry.name === "route.ts")
      files.push(full);
  }
  return files;
}

test("every admin page and route handler calls requireAdmin itself", async () => {
  const files = await listEntryFiles(ADMIN_DIR);
  assert.ok(
    files.some((file) => file.endsWith("page.tsx")),
    "expected admin pages to scan",
  );
  const unguarded: string[] = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (!/await requireAdmin\(\)/.test(source)) unguarded.push(file);
  }
  assert.deepEqual(unguarded, [], "admin entry points without requireAdmin()");
});
