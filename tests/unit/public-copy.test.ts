import test from "node:test";
import assert from "node:assert/strict";
import { revisePublicCopy } from "../../src/lib/content/public-copy";

test("known public defaults use informal copy without rewriting custom or legal text", () => {
  assert.equal(revisePublicCopy("Zázemí pro vás"), "Zázemí pro tebe");
  assert.equal(
    revisePublicCopy("Nahlédněte do NAVI Private Gym."),
    "Nahlédni do NAVI Private Gym.",
  );
  for (const custom of [
    "Seznam vybavení: běžecký pás, jednoručky.",
    "Nabízíte služby osobního trenéra?",
    "Objednávkou souhlasíte s obchodními podmínkami.",
  ])
    assert.equal(revisePublicCopy(custom), custom);
});
