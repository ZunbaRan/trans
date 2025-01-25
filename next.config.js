/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: true
  },
  server: {
    port: 3001
  }
}

module.exports = nextConfig 