import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Profile photos, company logos and other uploads live in Vercel Blob.
    // next/image refuses remote hosts that are not listed here.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default nextConfig;
