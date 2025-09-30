import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

interface LayoutProps {
  children: React.ReactNode
  params: Promise<{
    orgSlug: string
  }>
}

export default async function OrganizationLayout({ children, params }: LayoutProps) {
  const { orgSlug } = await params
  const supabase = await createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Get user's profile with organization
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, organizations(*)')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.organizations) {
    redirect('/dashboard')
  }

  const org = profile.organizations

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <Link href={`/org/${orgSlug}`} className="text-xl font-bold">
                {org.name}
              </Link>
              <nav className="flex items-center space-x-4">
                <Link
                  href={`/org/${orgSlug}`}
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href={`/org/${orgSlug}/classrooms`}
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  Classrooms
                </Link>
                <Link
                  href={`/org/${orgSlug}/members`}
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  Members
                </Link>
                {profile.role === 'admin' && (
                  <Link
                    href={`/org/${orgSlug}/settings`}
                    className="text-sm font-medium hover:text-primary transition-colors"
                  >
                    Settings
                  </Link>
                )}
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                {user.email} ({profile.role})
              </span>
              <Link
                href="/api/auth/signout"
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                Sign Out
              </Link>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}