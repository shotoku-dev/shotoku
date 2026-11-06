import type { MetadataRoute } from "next";
import { POSTS } from "./blog/posts";

const BASE = "https://shotoku.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { path: "", priority: 1.0 },
    { path: "/pricing", priority: 0.9 },
    { path: "/docs/quickstart", priority: 0.9 },
    { path: "/docs/api", priority: 0.8 },
    { path: "/docs/policies", priority: 0.8 },
    { path: "/docs/cli", priority: 0.8 },
    { path: "/docs/mcp", priority: 0.8 },
    { path: "/docs/x402", priority: 0.8 },
    { path: "/docs/paypal", priority: 0.8 },
    { path: "/docs/tui", priority: 0.7 },
    { path: "/docs/dashboard", priority: 0.7 },
    { path: "/docs/phone", priority: 0.7 },
    { path: "/docs/snapshots", priority: 0.7 },
    { path: "/blog", priority: 0.8 },
    { path: "/changelog", priority: 0.6 },
    { path: "/privacy", priority: 0.2 },
    { path: "/terms", priority: 0.2 },
    { path: "/license", priority: 0.2 },
  ];

  const posts = POSTS.map((post) => ({
    url: `${BASE}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [
    ...routes.map(({ path, priority }) => ({
      url: `${BASE}${path}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority,
    })),
    ...posts,
  ];
}
