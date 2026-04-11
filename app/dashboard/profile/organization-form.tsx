'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateOrganizationName } from '@/lib/actions/auth';
import { useUser } from '@/lib/contexts/UserContext';
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

interface OrganizationFormProps {
  currentName: string;
}

export function OrganizationForm({ currentName }: OrganizationFormProps) {
  const { refetch } = useUser();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);

    const result = await updateOrganizationName(formData);

    if (result.success) {
      setSuccess(true);
      // Refresh the in-memory profile so the sidebar / header pick up the
      // new name without a full page reload.
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
          id="orgName"
          name="orgName"
          label="Organization Name"
          defaultValue={currentName}
          maxLength={100}
          required
        />

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>
        )}

        {success && (
          <div className="text-sm text-green-600 bg-green-50 dark:bg-green-950 p-3 rounded-md">
            Organization name updated successfully!
          </div>
        )}

        <SubmitButton />
      </div>
    </form>
  );
}
