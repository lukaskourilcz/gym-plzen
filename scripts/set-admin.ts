/**
 * Promote a user to the admin role by e-mail (Supabase Auth).
 *
 *   npm run set-admin -- you@example.com
 *
 * Looks the user up via the Supabase Admin API (needs SUPABASE_SECRET_KEY or
 * SUPABASE_SERVICE_ROLE_KEY), then sets profiles.role = 'admin'. Run once after
 * registering your own account so you can access /admin.
 */
import "./_env";
import { createClient } from "@supabase/supabase-js";
import { db } from "../src/lib/db";
import { profiles } from "../src/lib/db/schema";

async function main() {
  const email = process.argv[2]?.toLowerCase();
  if (!email) {
    console.error("Usage: npm run set-admin -- <email>");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY. See NEEDED.md.",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Find the auth user by e-mail (paginate through the admin list).
  let userId: string | null = null;
  for (let page = 1; page <= 50 && !userId; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      console.error("Supabase admin error:", error.message);
      process.exit(1);
    }
    userId =
      data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
    if (data.users.length < 200) break;
  }

  if (!userId) {
    console.error(
      `No user found with e-mail ${email}. Register first, then re-run.`,
    );
    process.exit(1);
  }

  // Upsert the profile with the admin role (the trigger usually created it).
  await db
    .insert(profiles)
    .values({ id: userId, email, role: "admin" })
    .onConflictDoUpdate({
      target: profiles.id,
      set: { role: "admin", updatedAt: new Date() },
    });

  console.log(`✅ ${email} is now an administrator.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
