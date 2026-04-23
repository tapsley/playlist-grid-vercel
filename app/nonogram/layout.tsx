import type { Viewport } from 'next';

export const viewport: Viewport = {
  colorScheme: 'light',
};

export default function NonogramLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`body { background: #cca3ff !important; color: #111 !important; }`}</style>
      {children}
    </>
  );
}
