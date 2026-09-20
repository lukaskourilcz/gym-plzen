import assert from "node:assert/strict";
import test from "node:test";
import { accessCodeStatusLabel } from "../../src/lib/helpers/access-code-status";
const code = { status: "scheduled", validFrom: new Date("2026-09-20T10:45:00Z"), validUntil: new Date("2026-09-20T12:00:00Z") };
test("admin status reflects the exact validity boundaries without a database update", () => {
  assert.equal(accessCodeStatusLabel(code, new Date("2026-09-20T10:44:59Z")), "Čeká na začátek");
  assert.equal(accessCodeStatusLabel(code, code.validFrom), "Platný");
  assert.equal(accessCodeStatusLabel(code, new Date("2026-09-20T11:59:59Z")), "Platný");
  assert.equal(accessCodeStatusLabel(code, code.validUntil), "Platnost skončila");
});
test("revocation and unconfirmed provisioning do not display as usable PINs", () => {
  assert.equal(accessCodeStatusLabel({...code,status:"revoked"},code.validFrom),"Zrušený");
  assert.equal(accessCodeStatusLabel({...code,status:"failed"},code.validFrom),"Nepotvrzený v Nuki");
  assert.equal(accessCodeStatusLabel({...code,status:"used"},code.validFrom),"Platný");
});
