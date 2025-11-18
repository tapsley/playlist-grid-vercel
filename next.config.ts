import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
    images: {
    remotePatterns: [
      // Spotify album art CDN
      {
        protocol: 'https',
        hostname: 'i.scdn.co',
        port: '',
        pathname: '/image/**',
      },
      // Some Spotify images use paths directly under the hostname
      {
        protocol: 'https',
        hostname: 'i.scdn.co',
        port: '',
        pathname: '/**',
      },
      // Optional: cover other common CDNs used by third-party apps (if needed)
      // {
      //   protocol: 'https',
      //   hostname: 'mosaic.scdn.co',
      //   port: '',
      //   pathname: '/**',
      // },
    ],
  },
};

export default nextConfig;
