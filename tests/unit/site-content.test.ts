import assert from "node:assert/strict";
import test from "node:test";
import {
  PUBLIC_ADDRESS,
  publicAddress,
  publicPhone,
} from "../../src/lib/content/site";

test("public Czech contacts always include the country code and postcode", () => {
  assert.equal(publicPhone("731 737 355"), "+420 731 737 355");
  assert.equal(publicPhone("+420731737355"), "+420 731 737 355");
  assert.equal(publicPhone("00420 721 560 150"), "+420 721 560 150");
  assert.equal(
    publicAddress("Křížkova 424/23, Plzeň - Roudná"),
    PUBLIC_ADDRESS,
  );
  assert.match(PUBLIC_ADDRESS, /301 00/);
});
