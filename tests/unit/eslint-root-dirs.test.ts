import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, normalize } from "node:path";
import { test } from "node:test";
import { ESLint } from "eslint";

const require = createRequire(import.meta.url);
// Exercise the installed Next plugin, including its scoped glob dependency override.
const { getRootDirs } =
  require("@next/eslint-plugin-next/dist/utils/get-root-dirs") as {
    getRootDirs(context: {
      cwd: string;
      settings: { next?: { rootDir?: string | string[] } };
    }): string[];
  };

test("Next lint retains the default project root", () => {
  assert.deepEqual(getRootDirs({ cwd: process.cwd(), settings: {} }), [
    process.cwd(),
  ]);
});

test("Next lint resolves directory globs and multiple configured roots", (t) => {
  const fixture = mkdtempSync(join(tmpdir(), "navi-eslint-roots-"));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const web = join(fixture, "apps", "web");
  const admin = join(fixture, "apps", "admin");
  mkdirSync(web, { recursive: true });
  mkdirSync(admin, { recursive: true });
  writeFileSync(join(fixture, "apps", "ignore.txt"), "not a directory");
  const roots = (rootDir: string | string[]) =>
    getRootDirs({ cwd: fixture, settings: { next: { rootDir } } })
      .map(normalize)
      .sort();

  assert.deepEqual(roots(join(fixture, "apps", "*")), [admin, web].sort());
  assert.deepEqual(
    roots(join(fixture, "apps", "{web,admin}")),
    [admin, web].sort(),
  );
  assert.deepEqual(roots([web, admin]), [admin, web].sort());
  assert.deepEqual(roots(join(fixture, "missing", "*")), []);
});

test("Next lint still reports internal HTML links with a globbed project root", async (t) => {
  const fixture = mkdtempSync(join(tmpdir(), "navi-eslint-links-"));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const pages = join(fixture, "apps", "web", "pages");
  mkdirSync(pages, { recursive: true });
  writeFileSync(
    join(pages, "booking.tsx"),
    "export default function Booking() {}",
  );
  const eslint = new ESLint({
    overrideConfig: [
      { settings: { next: { rootDir: join(fixture, "apps", "*") } } },
    ],
  });
  const [result] = await eslint.lintText(
    'export default function Page() { return <a href="/booking">Rezervace</a>; }',
    { filePath: "src/lint-regression.tsx" },
  );
  assert.ok(
    result.messages.some(
      (message) =>
        message.ruleId === "@next/next/no-html-link-for-pages" &&
        message.severity === 2,
    ),
    JSON.stringify(result.messages),
  );
  const [valid] = await eslint.lintText(
    'import Link from "next/link"; export default function Page() { return <Link href="/booking">Rezervace</Link>; }',
    { filePath: "src/lint-regression.tsx" },
  );
  assert.equal(valid.errorCount, 0, JSON.stringify(valid.messages));
});
