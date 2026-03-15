/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) config.externals = [...(config.externals || []), 'canvas'];
    else config.resolve.fallback = { ...config.resolve?.fallback, canvas: false };
    return config;
  },
};
module.exports = nextConfig;
