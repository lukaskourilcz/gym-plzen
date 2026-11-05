import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata = { title: "Upozornění" };
export const dynamic = "force-dynamic";

/** Preserve saved links after moving customer notices into the content editor. */
export default async function NoticesPage() {
  await requireAdmin();
  redirect("/admin/content?section=notices");
}
