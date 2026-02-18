'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  organization_id: string;
  is_superadmin: boolean;
  created_at: string; // Timestamp from Supabase
  organization?: {
    id: string;
    name: string;
    slug: string;
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
    subscription_status?: string;
    subscription_tier?: string;
    current_period_end?: string | null;
  };
}

interface UserContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();

      // Get authenticated user
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      setUser(authUser);

      if (authUser) {
        // Fetch profile with organization
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select(
            `
            *,
            organization:organizations(*)
          `,
          )
          .eq('id', authUser.id)
          .single();

        if (profileError) {
          throw profileError;
        }

        setProfile(profileData);
      }
    } catch (err: any) {
      console.error('Error fetching user:', err);
      setError(err.message || 'Failed to fetch user data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();

    // Subscribe to auth changes
    const supabase = createClient();
    let currentAccessToken: string | undefined = undefined;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const newAccessToken = session?.access_token;

      // Only update if the access token actually changed
      // This prevents unnecessary re-fetches on tab refocus
      if (currentAccessToken !== newAccessToken) {
        currentAccessToken = newAccessToken;

        if (session?.user) {
          fetchUser();
        } else {
          setUser(null);
          setProfile(null);
        }
      }
      // Otherwise skip - just a tab refocus with same session
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <UserContext.Provider
      value={{
        user,
        profile,
        loading,
        error,
        refetch: fetchUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
