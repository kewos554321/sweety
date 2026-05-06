import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // LINE webhook needs raw body for signature verification
  api: {
    bodyParser: false,
  },
};

export default nextConfig;
