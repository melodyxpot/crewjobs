/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: "/applications/:id([0-9a-fA-F]{24})", destination: "/applications" },
      { source: "/jobs/:id([0-9a-fA-F]{24})", destination: "/jobs" },
      { source: "/calendar/:id([0-9a-fA-F]{24})", destination: "/calendar" },
    ]
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
