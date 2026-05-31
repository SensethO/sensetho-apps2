/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['postgres', 'pg', 'exceljs'],
  },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
