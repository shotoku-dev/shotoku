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
    slug: "how-to-set-a-spending-limit-on-an-ai-agent",
    title: "How to set a hard spending limit on an AI agent",
    description:
      "Why alerts and prompts don't stop an agent from overspending, and how to enforce a per-call and daily cap in code, with a tested example.",
    publishedAt: "2026-11-06",
    updatedAt: "2026-11-06",
  },
  {
    slug: "require-human-approval-mcp-tool-calls",
    title: "How to require human approval before an MCP tool call",
    description:
      "Three ways to put a human in front of MCP tools, which one an agent can't skip, and a tested setup for Claude Desktop and other MCP hosts.",
    publishedAt: "2026-11-06",
    updatedAt: "2026-11-06",
  },
  {
    slug: "stop-ai-agent-deleting-production-database",
    title: "How to stop an AI agent from deleting your production database",
    description:
      "What the PocketOS and DataTalks.Club incidents teach, which safeguards would have mattered, and what a tool policy can and can't prevent.",
    publishedAt: "2026-11-06",
    updatedAt: "2026-11-06",
  },
  {
    slug: "ai-support-agent-refund-limits",
    title: "How to let an AI support agent issue refunds safely",
    description:
      "Let an agent handle small refunds and send big ones to a human, using PayPal's MCP server, a dollar limit and a daily budget.",
    publishedAt: "2026-11-06",
    updatedAt: "2026-11-06",
  },
  {
    slug: "stop-ai-agent-emailing-wrong-people",
    title: "How to stop an AI agent from emailing the wrong people",
    description:
      "Allow internal email, hold everything else for a human, and check every recipient before an agent's message leaves your code.",
    publishedAt: "2026-11-06",
    updatedAt: "2026-11-06",
  },
  {
    slug: "audit-log-for-ai-agents",
    title: "How to prove what your AI agent did: a tamper-evident audit log",
    description:
      "We edited and deleted records in an agent's audit log to see what gets caught. Why a hash chain isn't enough on its own, and what to add.",
    publishedAt: "2026-11-06",
    updatedAt: "2026-11-06",
  },
  {
    slug: "what-are-spend-controls-for-ai-agents",
    title: "What are spend controls for AI agents?",
    description:
      "A plain definition: the five controls that limit what an agent can spend, where they should run, and how they differ from alerts and prompts.",
    publishedAt: "2026-11-06",
    updatedAt: "2026-11-06",
  },
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
