/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    tsconfigPath: 'tsconfig.build.json',
  },
  experimental: {
    typedEnv: true,
  },
};

export default nextConfig;
