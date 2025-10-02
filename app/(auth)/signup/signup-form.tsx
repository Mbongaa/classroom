'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { signUp } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';
import { FloatingLabelInput } from '@/components/ui/floating-label-input';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Creating account...' : 'Create Account'}
    </Button>
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');

  function handleOrgNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const name = e.target.value;
    setOrgName(name);
    setOrgSlug(slugify(name));
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await signUp(formData);
    if (!result.success && result.error) {
      setError(result.error);
    }
  }

  return (
    <div className="grid gap-6">
      <form action={handleSubmit}>
        <div className="grid gap-4">
          <FloatingLabelInput
            id="fullName"
            name="fullName"
            label="Full Name"
            type="text"
            autoCapitalize="words"
            autoComplete="name"
            required
          />
          <FloatingLabelInput
            id="email"
            name="email"
            label="Email"
            type="email"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect="off"
            required
          />
          <div className="grid gap-2">
            <FloatingLabelInput
              id="password"
              name="password"
              label="Password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
            />
            <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <span className="text-xs uppercase text-muted-foreground">Organization Details</span>
            <div className="w-full border-t" />
          </div>

          <div className="grid gap-2">
            <FloatingLabelInput
              id="orgName"
              name="orgName"
              label="Organization Name"
              type="text"
              value={orgName}
              onChange={handleOrgNameChange}
              required
            />
            <p className="text-xs text-muted-foreground">
              Your school, company, or organization name
            </p>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">bayaan.app/</span>
              <FloatingLabelInput
                id="orgSlug"
                name="orgSlug"
                label="URL Slug"
                type="text"
                value={orgSlug}
                onChange={(e) => setOrgSlug(slugify(e.target.value))}
                required
                className="flex-1"
                // No pattern attribute - slugify handles validation
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers, and hyphens only
            </p>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>
          )}

          <SubmitButton />
        </div>
      </form>
    </div>
  );
}
