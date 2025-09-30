'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { signUp } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Creating account...' : 'Create Account'}
    </Button>
  )
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim()
}

export function SignupForm() {
  const [error, setError] = useState<string | null>(null)
  const [orgName, setOrgName] = useState('')
  const [orgSlug, setOrgSlug] = useState('')

  function handleOrgNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const name = e.target.value
    setOrgName(name)
    setOrgSlug(slugify(name))
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    const result = await signUp(formData)
    if (!result.success && result.error) {
      setError(result.error)
    }
  }

  return (
    <div className="grid gap-6">
      <form action={handleSubmit}>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              name="fullName"
              placeholder="John Doe"
              type="text"
              autoCapitalize="words"
              autoComplete="name"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              placeholder="name@example.com"
              type="email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
            />
            <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Organization Details
              </span>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="orgName">Organization Name</Label>
            <Input
              id="orgName"
              name="orgName"
              placeholder="My School"
              type="text"
              value={orgName}
              onChange={handleOrgNameChange}
              required
            />
            <p className="text-xs text-muted-foreground">Your school, company, or organization name</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="orgSlug">Organization URL</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">bayaan.app/</span>
              <Input
                id="orgSlug"
                name="orgSlug"
                placeholder="my-school"
                type="text"
                value={orgSlug}
                onChange={(e) => setOrgSlug(slugify(e.target.value))}
                required
                className="flex-1"
                // No pattern attribute - slugify handles validation
              />
            </div>
            <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and hyphens only</p>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          <SubmitButton />
        </div>
      </form>
    </div>
  )
}