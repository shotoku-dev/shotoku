import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The hosted dashboard demo is a static page in public/demo/. Next serves
  // public files by their full name only, so /demo needs pointing at it.
  async rewrites() {
    return [{ source: "/demo", destination: "/demo/index.html" }];
  },
};

export default nextConfig;
