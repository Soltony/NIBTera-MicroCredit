
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'play-lh.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
   webpack: (config, { isServer }) => {
    // This is the correct way to ignore optional TypeORM dependencies
    // in a Next.js project.
    if (!isServer) {
        return config;
    }
    config.externals.push(
        'pg',
        'sqlite3',
        'tedious',
        'pg-hstore',
        'pg-native',
        'mysql',
        'mysql2',
        'redis',
        'ioredis',
        'better-sqlite3',
        '@sap/hana-client',
        'react-native-sqlite-storage'
    );
    return config;
  },
};

export default nextConfig;
