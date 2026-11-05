import { unstable_cache, revalidatePath, revalidateTag } from "next/cache";
import {
  INSTAGRAM_CACHE_TAG,
  type InstagramFeed,
} from "@/lib/config/instagram";
import { loadInstagramFeed } from "./instagram";
const cached = unstable_cache(loadInstagramFeed, ["instagram-public-v1"], {
  revalidate: 300,
  tags: [INSTAGRAM_CACHE_TAG],
});
export async function getPublicInstagramFeed(): Promise<InstagramFeed> {
  try {
    const feed = await cached();
    const valid = Boolean(
      feed.validUntil && new Date(feed.validUntil).getTime() > Date.now(),
    );
    return {
      enabled: feed.enabled,
      posts: valid ? feed.posts : [],
      profile: valid ? (feed.profile ?? null) : null,
    };
  } catch {
    return { enabled: false, posts: [] };
  } // An optional feed cannot take down booking or the home page.
}
export function invalidateInstagram() {
  revalidateTag(INSTAGRAM_CACHE_TAG);
  revalidatePath("/");
  revalidatePath("/admin/content");
}
