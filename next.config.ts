import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-hosted on a NAS: standalone bundles a minimal server and only the
  // dependencies actually reached, so the image stays small.
  output: 'standalone',
  // The dev overlay badge sits bottom-left, exactly where the tab bar's first
  // tab is. Off, so what you see in development is what ships.
  devIndicators: false,
};

export default nextConfig;
