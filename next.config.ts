import type { NextConfig } from 'next';

const isTursoServerBuild = process.env.VERCEL === '1' || process.env.TURSO_MIGRATION_BUILD === '1';

const nextConfig: NextConfig = {
  // Vercel needs a server build for API routes (Turso auth/session). Keep static export for Electron builds.
  output: isTursoServerBuild ? undefined : 'export',
  distDir: isTursoServerBuild ? '.next' : 'out',
  trailingSlash: true, // Crucial para que Electron resuelva las rutas de archivos correctamente
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true, // Requerido para exportación estática
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  compress: true,
};

export default nextConfig;
