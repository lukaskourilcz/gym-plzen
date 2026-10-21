import {
  databaseReady,
  resetDatabase,
  rows,
  setSetting,
  stopEverything,
} from "./setup";
import { after, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { loadPublicNotices } from "../../src/lib/services/public-notices";
import { defaultPublicNotices } from "../../src/lib/config/public-notices";

describe(
  "public notice content is read-only and isolated from business settings",
  { skip: !databaseReady },
  () => {
    after(stopEverything);
    beforeEach(resetDatabase);
    test("defaults do not create records; selected public copy excludes unrelated settings and tolerates corruption", async () => {
      await setSetting("private.provider.credentials", {
        secret: "must-not-leak",
      });
      const before = await rows(
        "select key,value,updated_at from site_setting order by key",
      );
      assert.deepEqual(await loadPublicNotices(), defaultPublicNotices());
      assert.deepEqual(
        await rows(
          "select key,value,updated_at from site_setting order by key",
        ),
        before,
      );
      await setSetting("content.notice.cancellation", {
        ...defaultPublicNotices().cancellation,
        title: "Jen vlastní nadpis",
      });
      await setSetting("content.notice.cookies", ["corrupt"]);
      const afterWrite = await rows(
        "select key,value,updated_at from site_setting order by key",
      );
      const result = await loadPublicNotices();
      assert.equal(result.cancellation.title, "Jen vlastní nadpis");
      assert.deepEqual(result.cookies, defaultPublicNotices().cookies);
      assert.equal(JSON.stringify(result).includes("must-not-leak"), false);
      assert.deepEqual(
        await rows(
          "select key,value,updated_at from site_setting order by key",
        ),
        afterWrite,
      );
    });
  },
);
