/**
 * Promote a user to the admin role by e-mail.
 *
 *   npm run set-admin -- you@example.com
 *
 * Run once after registering your own account so you can access /admin.
 */
import "./_env";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { user } from "../src/lib/db/schema";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npm run set-admin -- <email>");
    process.exit(1);
  }

  const [updated] = await db
    .update(user)
    .set({ role: "admin", updatedAt: new Date() })
    .where(eq(user.email, email))
    .returning({ id: user.id, email: user.email });

  if (!updated) {
    console.error(`No user found with e-mail ${email}. Register first, then re-run.`);
    process.exit(1);
  }
  console.log(`✅ ${updated.email} is now an administrator.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
