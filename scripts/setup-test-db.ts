import postgres from "postgres";
import { readdir, readFile } from "node:fs/promises";
import { requireTestDatabaseUrl } from "../tests/helpers/test-database";

// Deliberately never loads .env.local or falls back to application credentials.
const sql = postgres(requireTestDatabaseUrl(), { max: 1, prepare: false });
try {
  const [existing] =
    await sql`select count(*)::int as n from information_schema.tables where table_schema = 'public'`;
  if (existing!.n !== 0)
    throw new Error(
      "Test bootstrap requires an empty database. Refusing to change existing data.",
    );
  const [database] = await sql`select current_database() as name`;
  await sql`alter database ${sql(database!.name)} set timezone to 'UTC'`;
  await sql`set timezone to 'UTC'`;
  await sql.unsafe(await readFile("tests/integration/bootstrap.sql", "utf8"));
  for (const file of (await readdir("drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const migration = await readFile(`drizzle/${file}`, "utf8");
    await sql.begin((tx) => tx.unsafe(migration));
    console.log(`${file}: OK`);
  }
} finally {
  await sql.end({ timeout: 2 });
}
