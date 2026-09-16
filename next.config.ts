import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: { "/*": ["./src/lib/db/migrations/**/*"] },
};

export default nextConfig;
