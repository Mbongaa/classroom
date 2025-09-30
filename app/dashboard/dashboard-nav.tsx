'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DashboardNavProps {
  user: {
    user: any
    profile: any
  }
}

export function DashboardNav({ user }: DashboardNavProps) {
  const pathname = usePathname()

  const navigation = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Classrooms', href: '/dashboard/classrooms' },
    { name: 'Recordings', href: '/dashboard/recordings' },
    { name: 'Profile', href: '/dashboard/profile' },
  ]

  async function handleSignOut() {
    await signOut()
  }

  return (
    <div className="border-b">
      <div className="container flex h-16 items-center px-4">
        <div className="mr-8 flex items-center space-x-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
          </svg>
          <span className="font-bold">Bayaan Classroom</span>
        </div>
        <nav className="flex items-center space-x-6 flex-1">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'text-sm font-medium transition-colors hover:text-primary',
                pathname === item.href ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {item.name}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <p className="font-medium">{user.profile?.full_name || user.user.email}</p>
            <p className="text-xs text-muted-foreground capitalize">{user.profile?.role}</p>
          </div>
          <form action={handleSignOut}>
            <Button variant="ghost" size="sm" type="submit">
              Sign Out
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}