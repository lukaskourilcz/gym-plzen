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
    return {
      enabled: feed.enabled,
      posts:
        feed.validUntil && new Date(feed.validUntil).getTime() > Date.now()
          ? feed.posts
          : [],
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
