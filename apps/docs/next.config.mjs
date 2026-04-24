import createMDX from '@next/mdx';

const normalizeBasePath = (value) => {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0 || trimmedValue === '/') {
    return undefined;
  }

  const leadingSlashValue = trimmedValue.startsWith('/') ? trimmedValue : `/${trimmedValue}`;
  const normalizedValue = leadingSlashValue.endsWith('/')
    ? leadingSlashValue.slice(0, -1)
    : leadingSlashValue;

  return normalizedValue.length > 0 ? normalizedValue : undefined;
};

const getBasePathFromDocsUrl = (value) => {
  if (!value) {
    return undefined;
  }

  try {
    return normalizeBasePath(new URL(value).pathname);
  } catch {
    return undefined;
  }
};

const basePath =
  normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH ?? '') ??
  getBasePathFromDocsUrl(process.env.NEXT_PUBLIC_DOCS_BASE_URL);

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
