import assert from "node:assert/strict";
import test from "node:test";
import {
  createRecoveryProof,
  RECOVERY_PROOF_PATH,
  recoveryProofCookieOptions,
  validRecoveryProof,
} from "../../src/lib/auth/recovery-proof";

const key = "a".repeat(64);
const user = "f21eade1-277a-40a7-b914-39d83fe6fd9b";
const now = Date.parse("2026-09-29T20:00:00Z");

test("only a recent, authentic recovery proof for this user permits password reset", () => {
  const proof = createRecoveryProof(user, now, key)!;
  assert.equal(validRecoveryProof(proof, user, now, key), true);
  assert.equal(
    validRecoveryProof(proof, "00000000-0000-4000-8000-000000000001", now, key),
    false,
  );
  assert.equal(validRecoveryProof(proof, user, now, "b".repeat(64)), false);
  assert.equal(validRecoveryProof(`${proof}0`, user, now, key), false);
  assert.equal(validRecoveryProof(proof, user, now + 15 * 60_000, key), false);
  assert.equal(validRecoveryProof(proof, user, now - 60_000, key), false);
  assert.equal(validRecoveryProof(undefined, user, now, key), false);
  assert.equal(createRecoveryProof(user, now, ""), null);
});

test("recovery proof stays HttpOnly and scoped to password reset", () => {
  assert.deepEqual(recoveryProofCookieOptions(true), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: RECOVERY_PROOF_PATH,
    maxAge: 900,
  });
});
