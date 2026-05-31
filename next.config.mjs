/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['postgres', 'pg', 'exceljs'],
  },
};

export default nextConfig;
