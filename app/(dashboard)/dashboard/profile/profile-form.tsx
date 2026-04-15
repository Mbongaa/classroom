'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { updateProfile } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';
import { FloatingLabelInput } from '@/components/ui/floating-label-input';

function SubmitButton() {
  const { pending } = useFormStatus();
  const tCommon = useTranslations('common');
  return (
    <Button type="submit" disabled={pending}>
      {pending ? tCommon('saving') : tCommon('saveChanges')}
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
  const t = useTranslations('profile.personal');
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
          label={t('fullName')}
          defaultValue={profile.full_name || ''}
          required
        />
        <div className="grid gap-2">
          <FloatingLabelInput
            id="avatarUrl"
            name="avatarUrl"
            label={t('avatarUrl')}
            type="url"
            defaultValue={profile.avatar_url || ''}
          />
          <p className="text-xs text-muted-foreground">{t('avatarHint')}</p>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>
        )}

        {success && (
          <div className="text-sm text-green-600 bg-green-50 dark:bg-green-950 p-3 rounded-md">
            {t('updated')}
          </div>
        )}

        <SubmitButton />
      </div>
    </form>
  );
}
