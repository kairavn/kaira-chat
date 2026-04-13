import type { Metadata } from 'next';

import localFont from 'next/font/local';

import './globals.css';

const geistSans = localFont({
  preload: false,
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  preload: false,
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'Kaira SDK Demo Showcase',
  description: 'Internal feature showcase for the Kaira chat SDK demos.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <html
      lang="en"
      suppressHydrationWarning
    >
      <body className={`${geistSans.className} ${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
