import assert from "node:assert/strict";
import test from "node:test";
import {
  isTestDatabaseUrl,
  requireTestDatabaseUrl,
} from "../helpers/test-database";

test("destructive tests accept only a dedicated, explicit local database", () => {
  for (const value of [
    undefined,
    "postgres://postgres@db.example.com/navi_test",
    "postgres://postgres@localhost/gym",
    "postgres://postgres@localhost/production",
    "postgres://postgres@localhost/navi_test?host=db.example.com",
    "postgres://postgres@localhost/navi_test?port=5432",
    "postgres://postgres@localhost/navi_test#fragment",
    "postgres://postgres@localhost.evil.test/navi_test",
  ]) {
    assert.equal(isTestDatabaseUrl(value), false, value);
    assert.throws(
      () => requireTestDatabaseUrl(value),
      /dedicated local database/,
    );
  }
  for (const value of [
    "postgres://postgres@127.0.0.1:55439/navi_launch_test",
    "postgresql://tester@localhost/test_navi",
    "postgres://tester@localhost/codex_navi_access_test",
  ])
    assert.equal(requireTestDatabaseUrl(value), value);
});
