import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'DevTip',
  description: 'Tip USDC to your favorite Farcaster devs',
  other: { 'fc:frame': JSON.stringify({ version: 'next', imageUrl: 'https://devtip.vercel.app/og.png', button: { title: 'Tip a Dev!', action: { type: 'launch_frame', url: 'https://devtip.vercel.app', name: 'DevTip', splashBackgroundColor: '#0f172a' } } }) }
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-900 text-white min-h-screen">{children}</body>
    </html>
  );
}
