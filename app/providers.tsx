'use client';

import { ThemeProvider } from 'next-themes';
import { HeroUIProvider } from '@heroui/react';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange={true}
    >
      <HeroUIProvider>
        {children}
      </HeroUIProvider>
    </ThemeProvider>
  );
}
