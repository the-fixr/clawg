import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'X-Frame-Options', value: 'ALLOWALL' }
      ]
    }];
  }
};
export default nextConfig;
