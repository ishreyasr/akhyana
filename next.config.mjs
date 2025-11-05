/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Exclude backend files from Next.js build
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],
  webpack: (config, { isServer }) => {
    // Ignore backend files during build
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/Backend/**', '**/node_modules/**'],
    };
    return config;
  },
}

export default nextConfig
