import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/public-env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = publicEnv.NEXT_PUBLIC_APP_URL;
  return [
    "",
    "/rezervace",
    "/faq",
    "/vybaveni",
    "/provozni-rad",
    "/obchodni-podminky",
    "/doprava-a-platba",
    "/ochrana-soukromi",
    "/login",
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency:
      path === "/rezervace" ? ("daily" as const) : ("weekly" as const),
    priority: path === "" ? 1 : path === "/rezervace" ? 0.9 : 0.6,
  }));
}
