import type { Metadata, Viewport } from 'next';
import { Courier_Prime } from 'next/font/google';

export const metadata: Metadata = {
  metadataBase: new URL('https://tapsley.space'),
  title: 'Daily Nonograms',
  description: 'A free daily nonogram puzzle in three sizes — Easy (5×5), Medium (10×10), and Hard (15×15). Solve today\'s puzzles, track your streaks, and compete for gold.',
  openGraph: {
    title: 'Daily Nonograms',
    description: 'A free daily nonogram puzzle in three sizes. Solve today\'s puzzles and compete for gold.',
    url: 'https://tapsley.space/nonogram',
    siteName: 'tapsley',
    type: 'website',
    images: [{ url: '/dailyNonogramsOG.png', width: 1200, height: 630, alt: 'Daily Nonograms' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Daily Nonograms',
    description: 'A free daily nonogram puzzle — Easy, Medium, and Hard. Solve today\'s and compete for gold.',
    images: ['/dailyNonogramsOG.png'],
  },
};

export const viewport: Viewport = {
  colorScheme: 'light',
};

const courierPrime = Courier_Prime({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-courier-prime',
  display: 'swap',
});

export default function NonogramLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={courierPrime.variable}>
      <style>{`
        body { background: #cca3ff !important; color: #111 !important; }
        .nonogram-root, .nonogram-root * { font-family: var(--font-courier-prime), 'Courier New', Courier, monospace; }
      `}</style>
      {children}
    </div>
  );
}
