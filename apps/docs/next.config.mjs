import createMDX from '@next/mdx';

const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const normalizedBasePath = rawBasePath.endsWith('/') ? rawBasePath.slice(0, -1) : rawBasePath;
const basePath = normalizedBasePath.length > 0 ? normalizedBasePath : undefined;

/** @type {import("next").NextConfig} */
const nextConfig = {
  pageExtensions: ['ts', 'tsx', 'mdx'],
  output: 'export',
  basePath,
  assetPrefix: basePath,
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  reactCompiler: true,
  experimental: {
    typedEnv: true,
  },
};

/**
 * rehype-pretty-code configuration for Shiki syntax highlighting.
 * Uses string-based plugin reference required for Next.js static export.
 * Note: Line highlighting callbacks (onVisitHighlightedLine, etc.) cannot be
 * used with static export - they must be handled client-side.
 */
const withMDX = createMDX({
  options: {
    remarkPlugins: [],
    rehypePlugins: [
      [
        'rehype-pretty-code',
        {
          theme: {
            dark: 'github-dark-dimmed',
            light: 'github-light',
          },
          keepBackground: false,
          defaultLang: 'plaintext',
          grid: true,
        },
      ],
    ],
  },
});

export default withMDX(nextConfig);
