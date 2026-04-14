'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateProfile } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';
import { FloatingLabelInput } from '@/components/ui/floating-label-input';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving...' : 'Save Changes'}
    </Button>
  );
}

interface ProfileFormProps {
  profile: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);

    const result = await updateProfile(formData);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } else if (result.error) {
      setError(result.error);
    }
  }

  return (
    <form action={handleSubmit}>
      <div className="grid gap-4">
        <FloatingLabelInput
          id="fullName"
          name="fullName"
          label="Full Name"
          defaultValue={profile.full_name || ''}
          required
        />
        <div className="grid gap-2">
          <FloatingLabelInput
            id="avatarUrl"
            name="avatarUrl"
            label="Avatar URL"
            type="url"
            defaultValue={profile.avatar_url || ''}
          />
          <p className="text-xs text-muted-foreground">Optional: Link to your profile picture</p>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>
        )}

        {success && (
          <div className="text-sm text-green-600 bg-green-50 dark:bg-green-950 p-3 rounded-md">
            Profile updated successfully!
          </div>
        )}

        <SubmitButton />
      </div>
    </form>
  );
}
