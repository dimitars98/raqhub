import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // turbopack: {
  //   root: __dirname,
  // },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "@supabase/ssr"],
    // 2. Disable preloading of all routes on start
    preloadEntriesOnStart: false,
    // cpus: 2,
  },
  // eslint: {
  //   ignoreDuringBuilds: true,
  // },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
