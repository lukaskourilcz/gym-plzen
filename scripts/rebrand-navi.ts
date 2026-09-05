/**
 * Rewrite the stored brand name from NAMASTÉ to NAVI.
 *
 *   npm run rebrand:navi           # report what would change
 *   npm run rebrand:navi -- --write
 *
 * Code defaults already say NAVI, but rows an administrator edited live win
 * over those defaults: content blocks shown on the site and the five e-mail
 * templates. This walks them once and replaces only known brand phrases, so it
 * is safe to run twice and never rewrites copy an operator wrote themselves.
 *
 * Deliberately left alone: `namastegym.cz` (the domain is a separate decision),
 * social handles (real external accounts), and legal wording the client owns.
 */
import "./_env";
import { fileURLToPath } from "node:url";
import { eq, like, or } from "drizzle-orm";
import { db } from "../src/lib/db";
import { contentBlock, siteSetting } from "../src/lib/db/schema";
import { rebrand } from "../src/lib/content/rebrand";

export { rebrand } from "../src/lib/content/rebrand";

async function main() {
  const write = process.argv.includes("--write");
  let changed = 0;

  const blocks = await db
    .select({ key: contentBlock.key, value: contentBlock.valueText })
    .from(contentBlock);
  for (const block of blocks) {
    if (!block.value) continue;
    const next = rebrand(block.value);
    if (next === block.value) continue;
    changed += 1;
    console.log(`content_block ${block.key}`);
    if (write) {
      await db
        .update(contentBlock)
        .set({ valueText: next })
        .where(eq(contentBlock.key, block.key));
    }
  }

  const settings = await db
    .select({ key: siteSetting.key, value: siteSetting.value })
    .from(siteSetting)
    .where(
      or(
        like(siteSetting.key, "messages.email.%"),
        like(siteSetting.key, "messages.sms.%"),
      ),
    );
  for (const setting of settings) {
    const raw = JSON.stringify(setting.value ?? null);
    const next = rebrand(raw);
    if (next === raw) continue;
    changed += 1;
    console.log(`site_setting ${setting.key}`);
    if (write) {
      await db
        .update(siteSetting)
        .set({ value: JSON.parse(next) })
        .where(eq(siteSetting.key, setting.key));
    }
  }

  console.log(
    changed === 0
      ? "Nothing to rebrand."
      : write
        ? `Rebranded ${changed} row(s).`
        : `${changed} row(s) would change. Re-run with --write.`,
  );
  process.exit(0);
}

/* Only touch the database when run as a script; the tests import `rebrand`. */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
