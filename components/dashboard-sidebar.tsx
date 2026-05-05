'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  IconArrowLeft,
  IconCalendar,
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
import { rtlLocales, type Locale } from '@/i18n/config';

interface NavItem {
  label: string;
  href: string;
  icon: typeof IconHome;
}

export function AppSidebar() {
  const { user, profile, loading } = useUser();
  const pathname = usePathname();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const locale = useLocale() as Locale;
  const t = useTranslations('sidebar');
  const isRTL = rtlLocales.has(locale);

  if (loading || !user || !profile) {
    return null;
  }

  const financeMatch = pathname.match(/^\/mosque-admin\/([^/]+)/);
  const isFinanceMode = financeMatch !== null;
  const financeSlug = financeMatch?.[1] ?? null;

  const translationNavigation: NavItem[] = [
    { label: t('translation.dashboard'), href: '/dashboard', icon: IconHome },
    { label: t('translation.classrooms'), href: '/dashboard/rooms', icon: IconSchool },
    {
      label: t('translation.sessionHistory'),
      href: '/dashboard/recordings',
      icon: IconHistory,
    },
  ];

  const financeNavigation: NavItem[] =
    isFinanceMode && financeSlug
      ? [
          {
            label: t('finance.dashboard'),
            href: `/mosque-admin/${financeSlug}`,
            icon: IconLayoutDashboard,
          },
          {
            label: t('finance.campaigns'),
            href: `/mosque-admin/${financeSlug}/campaigns`,
            icon: IconHeartHandshake,
          },
          {
            label: t('finance.members'),
            href: `/mosque-admin/${financeSlug}/members`,
            icon: IconUsers,
          },
          {
            label: t('finance.transactions'),
            href: `/mosque-admin/${financeSlug}/transactions`,
            icon: IconReceipt,
          },
          {
            label: t('finance.settings'),
            href: `/mosque-admin/${financeSlug}/settings`,
            icon: IconSettings,
          },
        ]
      : [];

  // Hidden behind a "Coming soon" badge until the feature is production-ready.
  const financeComingSoon: Pick<NavItem, 'label' | 'icon'>[] =
    isFinanceMode && financeSlug
      ? [
          { label: t('finance.products'), icon: IconPackage },
          { label: t('finance.appointments'), icon: IconCalendar },
        ]
      : [];

  const navigation: NavItem[] =
    isFinanceMode && financeSlug ? financeNavigation : translationNavigation;

  async function handleSignOut() {
    if (isMobile) {
      setOpenMobile(false);
    }
    await signOut();
  }

  return (
    <Sidebar collapsible="icon" side={isRTL ? 'right' : 'left'}>
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
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={state === 'collapsed' ? item.label : undefined}
                    >
                      <Link
                        href={item.href}
                        onClick={() => {
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

        {financeComingSoon.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <div
                className={cn(
                  'mt-2 mb-1 px-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground',
                  state === 'collapsed' && 'sr-only',
                )}
              >
                {t('finance.comingSoon')}
              </div>
              <SidebarMenu>
                {financeComingSoon.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      disabled
                      aria-disabled="true"
                      tooltip={
                        state === 'collapsed'
                          ? `${item.label} — ${t('finance.comingSoon')}`
                          : undefined
                      }
                      className="cursor-not-allowed opacity-60 hover:bg-transparent"
                    >
                      <item.icon className="size-4 text-black dark:text-white" />
                      <span className="text-black dark:text-white">{item.label}</span>
                      <span className="ms-auto rounded-full border border-[rgba(128,128,128,0.3)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {t('finance.soonBadge')}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/dashboard/billing'}
              tooltip={state === 'collapsed' ? t('footer.billing') : undefined}
            >
              <Link
                href="/dashboard/billing"
                onClick={() => {
                  if (isMobile) setOpenMobile(false);
                }}
              >
                <IconCreditCard className="size-4 text-black dark:text-white" />
                <span className="text-black dark:text-white">{t('footer.billing')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/dashboard/profile'}
              tooltip={state === 'collapsed' ? t('footer.profile') : undefined}
            >
              <Link
                href="/dashboard/profile"
                onClick={() => {
                  if (isMobile) setOpenMobile(false);
                }}
              >
                <IconUser className="size-4 text-black dark:text-white" />
                <span className="text-black dark:text-white">{t('footer.profile')}</span>
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
                    <span className="text-xs text-black dark:text-white">{t('footer.profile')}</span>
                  </div>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleSignOut}
              tooltip={state === 'collapsed' ? t('footer.signOut') : undefined}
            >
              <IconArrowLeft className="size-4 text-black dark:text-white" />
              <span className="text-black dark:text-white">{t('footer.signOut')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export default AppSidebar;
