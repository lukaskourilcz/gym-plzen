import assert from "node:assert/strict";
import { test } from "node:test";
import {
  accessCodeEmailTemplate,
  eveningEmailStart,
  eveningEmailStartSchema,
} from "../../src/lib/config/evening-email";
import { localDateTimeToDate } from "../../src/lib/helpers/datetime";

test("evening email uses Prague booking start inclusively across winter and summer", () => {
  for (const date of ["2026-07-15", "2026-10-25", "2026-12-15"]) {
    assert.equal(
      accessCodeEmailTemplate(localDateTimeToDate(date, 1259), 1260),
      "access_code",
    );
    assert.equal(
      accessCodeEmailTemplate(localDateTimeToDate(date, 1260), 1260),
      "access_code_evening",
    );
    assert.equal(
      accessCodeEmailTemplate(localDateTimeToDate(date, 1275), 1260),
      "access_code_evening",
    );
    assert.equal(
      accessCodeEmailTemplate(localDateTimeToDate(date, 1275), 1320),
      "access_code",
    );
  }
});
test("evening threshold validates settings and defaults safely", () => {
  for (const invalid of [null, "21:00", -1, 1440, 1.5])
    assert.equal(eveningEmailStart(invalid), 1260);
  assert.equal(eveningEmailStart(0), 0);
  assert.equal(
    eveningEmailStartSchema.safeParse({ time: "24:00" }).success,
    false,
  );
  assert.equal(
    eveningEmailStartSchema.safeParse({ time: "21:00" }).success,
    true,
  );
});
