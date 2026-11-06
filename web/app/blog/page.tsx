import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { POSTS, formatDate } from "./posts";

const DESCRIPTION = "Guides and comparisons on spend controls for AI agents: budgets, human approvals and audit trails.";

export const metadata: Metadata = {
  title: "Blog - Shotoku",
  description: DESCRIPTION,
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Shotoku Blog",
    description: DESCRIPTION,
    url: "https://shotoku.dev/blog",
    siteName: "Shotoku",
    type: "website",
    images: [{ url: "/assets/brand/shotoku-open-graph.png", width: 1200, height: 630, alt: "Shotoku Blog" }],
  },
};

const S = {
  page:  { paddingTop: 120, paddingBottom: 96, paddingLeft: 32, paddingRight: 32, maxWidth: 700, margin: "0 auto" } as React.CSSProperties,
  h1:    { fontSize: 28, fontWeight: 500, fontFamily: "Satoshi, var(--font-geist), sans-serif", color: "#0A0A0A", letterSpacing: "-0.025em", marginBottom: 6, lineHeight: 1.2 } as React.CSSProperties,
  meta:  { fontSize: 13, color: "rgba(0,0,0,0.45)", fontFamily: "var(--font-geist), sans-serif", marginBottom: 48 } as React.CSSProperties,
  entry: { display: "block", textDecoration: "none", marginBottom: 36 } as React.CSSProperties,
  title: { fontSize: 17, fontWeight: 500, fontFamily: "Satoshi, var(--font-geist), sans-serif", color: "#0A0A0A", letterSpacing: "-0.015em", lineHeight: 1.35, marginBottom: 4 } as React.CSSProperties,
  date:  { fontSize: 12, color: "rgba(0,0,0,0.45)", fontFamily: "var(--font-geist), sans-serif", marginBottom: 8 } as React.CSSProperties,
  desc:  { fontSize: 14.5, lineHeight: 1.7, color: "rgba(0,0,0,0.62)", fontFamily: "var(--font-geist), Satoshi, sans-serif" } as React.CSSProperties,
};

export default function BlogPage() {
  return (
    <>
      <Navbar />
      <div style={S.page}>
        <h1 style={S.h1}>Blog</h1>
        <p style={S.meta}>Spend controls for AI agents, in practice.</p>

        {POSTS.map((post) => (
          <Link key={post.slug} href={`/blog/${post.slug}`} style={S.entry}>
            <h2 style={S.title}>{post.title}</h2>
            <div style={S.date}>{formatDate(post.publishedAt)}</div>
            <p style={S.desc}>{post.description}</p>
          </Link>
        ))}
      </div>
      <Footer />
    </>
  );
}
