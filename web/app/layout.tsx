import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./components/dotmatrix-loader.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shotoku - Local-first authorization for AI agents",
  description: "See, approve, and audit what your AI agents do before they act. Runs entirely on your machine. No cloud. No custody.",
  icons: {
    icon: "/assets/brand/shotoku-favicon.svg",
    shortcut: "/assets/brand/shotoku-favicon.svg",
    apple: "/assets/brand/shotoku-favicon.svg",
  },
  openGraph: {
    title: "Shotoku - Local-first authorization for AI agents",
    description: "See, approve, and audit what your AI agents do before they act. Runs entirely on your machine. No cloud. No custody.",
    url: "https://shotoku.dev",
    siteName: "Shotoku",
    type: "website",
    images: [
      {
        url: "/assets/brand/shotoku-open-graph.png",
        width: 1200,
        height: 630,
        alt: "Shotoku - Local-first authorization for AI agents",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Shotoku - Local-first authorization for AI agents",
    description: "See, approve, and audit what your AI agents do before they act. Runs entirely on your machine. No cloud. No custody.",
    images: ["/assets/brand/shotoku-open-graph.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} antialiased`}>
      <head>
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap" />
      </head>
      <body className="text-pretty">{children}</body>
    </html>
  );
}
