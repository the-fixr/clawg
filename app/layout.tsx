import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Obol — x402 Code Generation API',
  description:
    'Pay-per-call APIs via x402. No subscriptions. AI code generation that forks your repo and opens a PR ($5 USDC). Clanker token analytics across 639k+ tokens ($0.01 USDC).',
  keywords: ['x402', 'API', 'code generation', 'Claude', 'Clanker', 'Base', 'USDC', 'Farcaster'],
  openGraph: {
    title: 'Obol — x402 Code Generation API',
    description: 'Pay-per-call APIs via x402. No subscriptions.',
    url: 'https://obol.sh',
    siteName: 'Obol',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Obol — x402 Code Generation API',
    description: 'Pay-per-call APIs via x402. No subscriptions.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-zinc-950 text-zinc-50 antialiased">{children}</body>
    </html>
  );
}
