import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Spotify album art CDN
      {
        protocol: "https",
        hostname: "i.scdn.co",
        port: "",
        pathname: "/image/**",
      },
      // Some Spotify images use paths directly under the hostname
      {
        protocol: "https",
        hostname: "i.scdn.co",
        port: "",
        pathname: "/**",
      },
      // Optional: cover other common CDNs used by third-party apps (if needed)
      // {
      //   protocol: "https",
      //   hostname: "mosaic.scdn.co",
      //   port: "",
      //   pathname: "/**",
      // },
    ],
  },
  async headers() {
    const isolationHeaders = [
      {
        key: "Cross-Origin-Opener-Policy",
        value: "same-origin",
      },
      {
        key: "Cross-Origin-Embedder-Policy",
        value: "require-corp",
      },
    ];

    return [
      {
        source: "/roku",
        headers: isolationHeaders,
      },
      {
        source: "/roku/:path*",
        headers: isolationHeaders,
      },
      {
        source: "/roku-engine/:path*",
        headers: isolationHeaders,
      },
    ];
  },
};

export default nextConfig;
