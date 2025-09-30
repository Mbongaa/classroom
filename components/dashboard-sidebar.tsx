"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconArrowLeft,
  IconHome,
  IconSchool,
  IconVideo,
  IconUser,
} from "@tabler/icons-react";
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
} from "@/components/ui/sidebar";

const navigation = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: IconHome,
  },
  {
    label: "Classrooms",
    href: "/dashboard/rooms",
    icon: IconSchool,
  },
  {
    label: "Recordings",
    href: "/dashboard/recordings",
    icon: IconVideo,
  },
  {
    label: "Profile",
    href: "/dashboard/profile",
    icon: IconUser,
  },
];

export function AppSidebar() {
  const { user, profile, loading } = useUser();
  const pathname = usePathname();

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
        <div className="flex items-center justify-center p-2">
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
                    <SidebarMenuButton asChild isActive={isActive}>
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
            <SidebarMenuButton asChild>
              <Link href="/dashboard/profile">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg border border-sidebar-border text-sidebar-foreground">
                  <span className="text-xs font-semibold">
                    {(profile.full_name || user.email || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">{profile.full_name || user.email}</span>
                  <span className="text-xs">Profile</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut}>
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