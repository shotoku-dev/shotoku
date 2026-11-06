import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "../Navbar";
import Footer from "../Footer";
import { formatDate, type BlogPost } from "../../blog/posts";

const BASE = "https://shotoku.dev";

export const S = {
  page:    { paddingTop: 120, paddingBottom: 96, paddingLeft: 32, paddingRight: 32, maxWidth: 760, margin: "0 auto" } as React.CSSProperties,
  back:    { fontSize: 13, color: "rgba(0,0,0,0.45)", fontFamily: "var(--font-geist), sans-serif", textDecoration: "none" } as React.CSSProperties,
  h1:      { fontSize: 30, fontWeight: 500, fontFamily: "Satoshi, var(--font-geist), sans-serif", color: "#0A0A0A", letterSpacing: "-0.025em", marginTop: 20, marginBottom: 10, lineHeight: 1.2 } as React.CSSProperties,
  meta:    { fontSize: 13, color: "rgba(0,0,0,0.45)", fontFamily: "var(--font-geist), sans-serif", marginBottom: 40 } as React.CSSProperties,
  h2:      { fontSize: 20, fontWeight: 500, fontFamily: "Satoshi, var(--font-geist), sans-serif", color: "#0A0A0A", marginTop: 48, marginBottom: 12, letterSpacing: "-0.015em", lineHeight: 1.3 } as React.CSSProperties,
  h3:      { fontSize: 15, fontWeight: 600, fontFamily: "Satoshi, var(--font-geist), sans-serif", color: "#0A0A0A", marginTop: 28, marginBottom: 8 } as React.CSSProperties,
  p:       { fontSize: 15, lineHeight: 1.8, color: "rgba(0,0,0,0.68)", fontFamily: "var(--font-geist), Satoshi, sans-serif", marginBottom: 14 } as React.CSSProperties,
  ul:      { margin: "8px 0 14px", paddingLeft: 20, listStyle: "disc" } as React.CSSProperties,
  ol:      { margin: "8px 0 14px", paddingLeft: 20, listStyle: "decimal" } as React.CSSProperties,
  li:      { fontSize: 15, lineHeight: 1.8, color: "rgba(0,0,0,0.68)", fontFamily: "var(--font-geist), Satoshi, sans-serif", marginBottom: 4 } as React.CSSProperties,
  a:       { color: "#DB0028", textDecoration: "none" } as React.CSSProperties,
  note:    { background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, padding: "14px 18px", marginBottom: 18, fontSize: 14, lineHeight: 1.7, color: "rgba(0,0,0,0.68)", fontFamily: "var(--font-geist), Satoshi, sans-serif" } as React.CSSProperties,
  scroll:  { overflowX: "auto" as const, marginBottom: 20 } as React.CSSProperties,
  table:   { width: "100%", borderCollapse: "collapse" as const },
  th:      { textAlign: "left" as const, padding: "8px 10px", fontFamily: "Satoshi, var(--font-geist), sans-serif", fontWeight: 500, color: "rgba(0,0,0,0.5)", fontSize: 12, borderBottom: "1px solid rgba(0,0,0,0.08)" } as React.CSSProperties,
  td:      { padding: "10px", color: "rgba(0,0,0,0.68)", borderBottom: "1px solid rgba(0,0,0,0.05)", verticalAlign: "top" as const, lineHeight: 1.5, fontFamily: "var(--font-geist), sans-serif", fontSize: 13 } as React.CSSProperties,
  tdKey:   { padding: "10px", borderBottom: "1px solid rgba(0,0,0,0.05)", verticalAlign: "top" as const, lineHeight: 1.5, fontFamily: "Satoshi, var(--font-geist), sans-serif", fontSize: 13, color: "#0A0A0A", fontWeight: 500 } as React.CSSProperties,
};

export function Table({ headers, rows, minWidth }: { headers: string[]; rows: (string | React.ReactNode)[][]; minWidth?: number }) {
  return (
    <div style={S.scroll} tabIndex={minWidth ? 0 : undefined} role={minWidth ? "region" : undefined} aria-label={minWidth ? "Comparison table" : undefined}>
      <table style={{ ...S.table, minWidth }}>
        <thead><tr>{headers.map((h, i) => <th key={i} scope="col" style={S.th}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => <td key={j} style={j === 0 ? S.tdKey : S.td}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function postMetadata(post: BlogPost): Metadata {
  const path = `/blog/${post.slug}`;
  return {
    title: `${post.title} - Shotoku`,
    description: post.description,
    alternates: { canonical: path },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `${BASE}${path}`,
      siteName: "Shotoku",
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      images: [{ url: "/assets/brand/shotoku-open-graph.png", width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: ["/assets/brand/shotoku-open-graph.png"],
    },
  };
}

function jsonLd(post: BlogPost): string {
  const shotoku = { "@type": "Organization", name: "Shotoku", url: BASE };
  const data = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: `${BASE}/blog/${post.slug}`,
    image: `${BASE}/assets/brand/shotoku-open-graph.png`,
    author: shotoku,
    publisher: shotoku,
    about: {
      "@type": "SoftwareApplication",
      name: "Shotoku",
      applicationCategory: "DeveloperApplication",
      description: "Local-first spend controls for AI agents.",
      url: BASE,
    },
  };
  // "<" is escaped so post text can never close the script tag.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function PostLayout({ post, children }: { post: BlogPost; children: React.ReactNode }) {
  const updated = post.updatedAt !== post.publishedAt ? ` · Updated ${formatDate(post.updatedAt)}` : "";

  return (
    <>
      <Navbar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(post) }} />
      <article style={S.page}>
        <Link href="/blog" style={S.back}>&larr; Blog</Link>
        <h1 style={S.h1}>{post.title}</h1>
        <p style={S.meta}>
          <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
          {updated} · By the Shotoku team
        </p>
        {children}
      </article>
      <Footer />
    </>
  );
}
