import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    // Prevent webpack from bundling pdfjs-dist (loaded from CDN instead)
    if (!isServer) {
      config.externals = [...(config.externals || []), 'pdfjs-dist'];
    }
    return config;
  },
};

export default nextConfig;
