import { Toaster } from 'react-hot-toast';

/**
 * Learning Page Layout
 *
 * Simple layout for public learning pages.
 * Fixed-height container with no overflow (children manage their own scrolling).
 */
export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-full overflow-hidden">
      {children}
      <Toaster position="top-center" />
    </div>
  );
}
