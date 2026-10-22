import { getPublicInstagramFeed } from "@/lib/services/instagram-cache";
import { InstagramFeed, type InstagramCopy } from "./instagram-feed";

/** Rendered in a server Suspense boundary: this optional read cannot delay the hero calendar. */
export async function HomeInstagram({ copy }: { copy: InstagramCopy }) {
  const feed = await getPublicInstagramFeed();
  return feed.enabled ? <InstagramFeed posts={feed.posts} copy={copy} /> : null;
}
