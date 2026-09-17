import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("tinted notices never use a white tone foreground for their text", async () => {
  // `--*-foreground` tokens are white, meant for text on a solid tone
  // background. On a 10–15 % tint they are unreadable, which is how the
  // warning notice on the e-mails page shipped as light text on beige.
  const source = await readFile("src/components/ui/notice.tsx", "utf8");
  const styleBlock = source.slice(
    source.indexOf("const styles = {"),
    source.indexOf("} as const;"),
  );
  for (const line of styleBlock.split("\n")) {
    if (!/bg-[a-z]+\/\d+/.test(line)) continue;
    assert.doesNotMatch(
      line,
      /text-(info|success|warning|destructive)-foreground/,
      `tinted tone must use the page foreground: ${line.trim()}`,
    );
    assert.match(line, /text-foreground/, line.trim());
  }
});
