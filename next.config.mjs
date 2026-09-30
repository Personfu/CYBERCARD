/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Keep Turbopack's project scan inside this repo instead of walking into
  // unrelated parent workspaces and lockfiles.
  turbopack: {
    root: process.cwd()
  }
}

export default nextConfig
