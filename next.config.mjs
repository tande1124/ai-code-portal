/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // 允许在 server actions 中执行更长时间的操作
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
