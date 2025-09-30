'use client';

import { UserProvider } from '@/lib/contexts/UserContext';

export function UserProviderWrapper({ children }: { children: React.ReactNode }) {
  return <UserProvider>{children}</UserProvider>;
}