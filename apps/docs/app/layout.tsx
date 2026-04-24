import type { Metadata } from 'next';
import type { JSX, ReactNode } from 'react';

import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';

import { CodeBlockScript } from '@/components/docs/code-block-script';
import { DocsLayout } from '@/components/docs/docs-layout';
import { ThemeProvider } from '@/components/docs/theme-provider';

import './globals.css';

const getDocsMetadataBase = (): URL | undefined => {
  const docsBaseUrl = process.env.NEXT_PUBLIC_DOCS_BASE_URL;

  if (!docsBaseUrl) {
    return undefined;
  }

  try {
    return new URL(docsBaseUrl.endsWith('/') ? docsBaseUrl : `${docsBaseUrl}/`);
  } catch {
    return undefined;
  }
};

const docsMetadataBase = getDocsMetadataBase();

export const metadata: Metadata = {
  ...(docsMetadataBase ? { metadataBase: docsMetadataBase } : {}),
  title: {
    default: 'Kaira Chat SDK Documentation',
    template: '%s | Kaira Chat SDK',
  },
  description: 'Developer documentation for the modular Kaira Chat SDK.',
};

/**
 * Theme initialization script to prevent flash on load.
 * Runs before React hydration to set the correct theme.
 */
const themeInitScript = `
  (function() {
    try {
      const theme = localStorage.getItem('docs-theme') || 'system';
      const resolved = theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : theme;
      document.documentElement.setAttribute('data-theme', resolved);
    } catch (e) {
      // Fallback to light if localStorage is unavailable
      document.documentElement.setAttribute('data-theme', 'light');
    }
  })();
`;

export default function RootLayout({ children }: { readonly children: ReactNode }): JSX.Element {
  return (
    <html
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}>
        <ThemeProvider defaultTheme="system">
          <DocsLayout>{children}</DocsLayout>
          <CodeBlockScript />
        </ThemeProvider>
      </body>
    </html>
  );
}
