import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Workspace packages ship TypeScript source, not build output — design doc §11.
  transpilePackages: [
    "@headroom/contracts",
    "@headroom/engine-mcp",
    "@headroom/graph",
    "@headroom/tokens",
  ],
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
