import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module — it must stay in node_modules at runtime
  // rather than be traced/bundled into a server build.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
