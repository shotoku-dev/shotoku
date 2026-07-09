import type { MetadataRoute } from "next";

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
    { path: "/docs/tui", priority: 0.7 },
    { path: "/docs/snapshots", priority: 0.7 },
    { path: "/changelog", priority: 0.6 },
    { path: "/privacy", priority: 0.2 },
    { path: "/terms", priority: 0.2 },
    { path: "/license", priority: 0.2 },
  ];

  return routes.map(({ path, priority }) => ({
    url: `${BASE}${path}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority,
  }));
}
