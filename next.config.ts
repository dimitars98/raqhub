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
      // Profile pictures uploaded to Supabase Storage (public buckets only)
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // Profile pictures of people who signed up with Google
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
