import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // There is a lockfile in the user's home directory above this project, so Turbopack infers the
  // wrong workspace root. Pin it to this app.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
