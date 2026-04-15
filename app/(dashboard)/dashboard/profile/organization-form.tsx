'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { updateOrganizationName } from '@/lib/actions/auth';
import { useUser } from '@/lib/contexts/UserContext';
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

interface OrganizationFormProps {
  currentName: string;
}

export function OrganizationForm({ currentName }: OrganizationFormProps) {
  const { refetch } = useUser();
  const t = useTranslations('profile.organization');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);

    const result = await updateOrganizationName(formData);

    if (result.success) {
      setSuccess(true);
      await refetch();
      setTimeout(() => setSuccess(false), 3000);
    } else if (result.error) {
      setError(result.error);
    }
  }

  return (
    <form action={handleSubmit}>
      <div className="grid gap-4">
        <FloatingLabelInput
          key={currentName}
          id="orgName"
          name="orgName"
          label={t('name')}
          defaultValue={currentName}
          maxLength={100}
          required
        />

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
