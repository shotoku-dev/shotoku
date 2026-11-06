export interface BlogPost {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly publishedAt: string;
  readonly updatedAt: string;
}

/** Newest first. Every post needs an entry here to reach the index and the sitemap. */
export const POSTS: readonly BlogPost[] = [
  {
    slug: "x402-spend-controls-compared",
    title: "x402 spend controls compared: Shotoku, AgentPay MCP, x402-cfo and PolicyLayer",
    description:
      "How four tools put a budget on x402 payments: who holds the key, where the decision runs, what a human can stop, and what survives a restart.",
    publishedAt: "2026-11-06",
    updatedAt: "2026-11-06",
  },
];

export function getPost(slug: string): BlogPost {
  const post = POSTS.find((p) => p.slug === slug);
  if (!post) throw new Error(`Unknown blog post: ${slug}`);
  return post;
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
