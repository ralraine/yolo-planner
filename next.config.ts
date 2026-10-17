import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The authenticated dashboard needs request-time cookies and database reads.
  // Disable Cache Components for this starter to avoid premature prerendering.
  cacheComponents: false,
};

export default nextConfig;
