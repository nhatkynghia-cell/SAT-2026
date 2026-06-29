import type { NextConfig } from "next";
import { fileURLToPath } from "url";
import path from "path";

const nextConfig: NextConfig = {
  // Ghim root về thư mục sat-prep-web để Turbopack không chọn nhầm lockfile ở thư mục cha.
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
};

export default nextConfig;
