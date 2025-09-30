'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconArrowLeft, IconHome, IconSchool, IconVideo, IconUser } from '@tabler/icons-react';
import { signOut } from '@/lib/actions/auth';
import { useUser } from '@/lib/contexts/UserContext';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

const navigation = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: IconHome,
  },
  {
    label: 'Classrooms',
    href: '/dashboard/rooms',
    icon: IconSchool,
  },
  {
    label: 'Recordings',
    href: '/dashboard/recordings',
    icon: IconVideo,
  },
  {
    label: 'Profile',
    href: '/dashboard/profile',
    icon: IconUser,
  },
];

export function AppSidebar() {
  const { user, profile, loading } = useUser();
  const pathname = usePathname();
  const { state } = useSidebar();

  // Show nothing while loading (middleware will handle auth)
  if (loading || !user || !profile) {
    return null;
  }

  async function handleSignOut() {
    await signOut();
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center p-2">
          <SidebarTrigger />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={state === 'collapsed' ? item.label : undefined}
                    >
                      <Link href={item.href}>
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip={state === 'collapsed' ? profile.full_name || user.email : undefined}
            >
              <Link href="/dashboard/profile">
                <div
                  className={cn(
                    'flex items-center justify-center rounded-lg border border-sidebar-border text-sidebar-foreground aspect-square',
                    state === 'expanded' ? 'size-8' : 'size-5',
                  )}
                >
                  <span
                    className={cn(
                      'font-semibold',
                      state === 'expanded' ? 'text-xs' : 'text-[10px]',
                    )}
                  >
                    {(profile.full_name || user.email || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
                {state === 'expanded' && (
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-semibold">{profile.full_name || user.email}</span>
                    <span className="text-xs">Profile</span>
                  </div>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleSignOut}
              tooltip={state === 'collapsed' ? 'Sign Out' : undefined}
            >
              <IconArrowLeft className="size-4" />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export default AppSidebar;
