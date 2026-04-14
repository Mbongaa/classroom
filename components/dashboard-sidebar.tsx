'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconArrowLeft,
  IconCreditCard,
  IconHeartHandshake,
  IconHome,
  IconLayoutDashboard,
  IconPackage,
  IconReceipt,
  IconSchool,
  IconSettings,
  IconHistory,
  IconUser,
  IconUsers,
} from '@tabler/icons-react';
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

interface NavItem {
  label: string;
  href: string;
  icon: typeof IconHome;
}

const translationNavigation: NavItem[] = [
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
    label: 'Session History',
    href: '/dashboard/recordings',
    icon: IconHistory,
  },
];

/**
 * Build the finance dashboard navigation for a given org slug. Items here
 * mirror the actual routes under `/mosque-admin/[slug]/*`. When new finance
 * pages are added (e.g. campaigns, donors, payouts), drop them in here.
 */
function buildFinanceNavigation(slug: string): NavItem[] {
  return [
    {
      label: 'Dashboard',
      href: `/mosque-admin/${slug}`,
      icon: IconLayoutDashboard,
    },
    {
      label: 'Campaigns',
      href: `/mosque-admin/${slug}/campaigns`,
      icon: IconHeartHandshake,
    },
    {
      label: 'Products',
      href: `/mosque-admin/${slug}/products`,
      icon: IconPackage,
    },
    {
      label: 'Members',
      href: `/mosque-admin/${slug}/members`,
      icon: IconUsers,
    },
    {
      label: 'Transactions',
      href: `/mosque-admin/${slug}/transactions`,
      icon: IconReceipt,
    },
    {
      label: 'Settings',
      href: `/mosque-admin/${slug}/settings`,
      icon: IconSettings,
    },
  ];
}

export function AppSidebar() {
  const { user, profile, loading } = useUser();
  const pathname = usePathname();
  const { state, isMobile, setOpenMobile } = useSidebar();

  // Show nothing while loading (middleware will handle auth)
  if (loading || !user || !profile) {
    return null;
  }

  // Detect which dashboard mode we're in by inspecting the pathname.
  // `/mosque-admin/<slug>/...` → finance nav, anything else → translation nav.
  const financeMatch = pathname.match(/^\/mosque-admin\/([^/]+)/);
  const isFinanceMode = financeMatch !== null;
  const financeSlug = financeMatch?.[1] ?? null;
  const navigation: NavItem[] =
    isFinanceMode && financeSlug
      ? buildFinanceNavigation(financeSlug)
      : translationNavigation;

  async function handleSignOut() {
    // Close mobile sidebar before signing out
    if (isMobile) {
      setOpenMobile(false);
    }
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
                      <Link
                        href={item.href}
                        onClick={() => {
                          // Close mobile sidebar when navigating
                          if (isMobile) {
                            setOpenMobile(false);
                          }
                        }}
                      >
                        <item.icon className="size-4 text-black dark:text-white" />
                        <span className="text-black dark:text-white">{item.label}</span>
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
              isActive={pathname === '/dashboard/billing'}
              tooltip={state === 'collapsed' ? 'Billing' : undefined}
            >
              <Link
                href="/dashboard/billing"
                onClick={() => {
                  if (isMobile) setOpenMobile(false);
                }}
              >
                <IconCreditCard className="size-4 text-black dark:text-white" />
                <span className="text-black dark:text-white">Billing</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/dashboard/profile'}
              tooltip={state === 'collapsed' ? 'Profile' : undefined}
            >
              <Link
                href="/dashboard/profile"
                onClick={() => {
                  if (isMobile) setOpenMobile(false);
                }}
              >
                <IconUser className="size-4 text-black dark:text-white" />
                <span className="text-black dark:text-white">Profile</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip={state === 'collapsed' ? profile.full_name || user.email : undefined}
            >
              <Link
                href="/dashboard/profile"
                onClick={() => {
                  if (isMobile) setOpenMobile(false);
                }}
              >
                <div
                  className={cn(
                    'flex items-center justify-center rounded-lg border border-[rgba(128,128,128,0.3)] text-sidebar-foreground aspect-square',
                    state === 'expanded' ? 'size-8' : 'size-5',
                  )}
                >
                  <span
                    className={cn(
                      'font-semibold text-black dark:text-white',
                      state === 'expanded' ? 'text-xs' : 'text-[10px]',
                    )}
                  >
                    {(profile.full_name || user.email || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
                {state === 'expanded' && (
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-semibold text-black dark:text-white">
                      {profile.full_name || user.email}
                    </span>
                    <span className="text-xs text-black dark:text-white">Profile</span>
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
              <IconArrowLeft className="size-4 text-black dark:text-white" />
              <span className="text-black dark:text-white">Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export default AppSidebar;
