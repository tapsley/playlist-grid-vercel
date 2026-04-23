import type { Viewport } from 'next';
import { Courier_Prime } from 'next/font/google';

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
