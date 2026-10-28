import { databaseReady } from "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { requireTestDatabaseUrl } from "../helpers/test-database";

test(
  "bootstrap refuses non-UTF8 local databases before any migration or seed",
  { skip: !databaseReady },
  async () => {
    const source = new URL(requireTestDatabaseUrl());
    const name = `navi_encoding_${process.pid}_test`;
    const admin = postgres(source.toString(), { max: 1, prepare: false });
    await admin`create database ${admin(name)} template template0 encoding 'SQL_ASCII' lc_collate 'C' lc_ctype 'C'`;
    source.pathname = `/${name}`;
    const url = requireTestDatabaseUrl(source.toString());
    const isolated = postgres(url, { max: 1, prepare: false });
    try {
      await assert.rejects(
        promisify(execFile)(
          process.execPath,
          ["--import", "tsx", "scripts/setup-test-db.ts"],
          {
            env: { ...process.env, TEST_DATABASE_URL: url },
            timeout: 15_000,
          },
        ),
        /Test database must use UTF8/,
      );
      const [tables] =
        await isolated`select count(*)::int as n from information_schema.tables where table_schema='public'`;
      assert.equal(tables!.n, 0);
    } finally {
      await isolated.end({ timeout: 2 });
      await admin`drop database ${admin(name)}`;
      await admin.end({ timeout: 2 });
    }
  },
);
