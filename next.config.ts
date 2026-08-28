import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev overlay badge sits bottom-left, exactly where the tab bar's first
  // tab is. Off, so what you see in development is what ships.
  devIndicators: false,
};

export default nextConfig;
