import { Metadata } from 'next';
import { AuthShell } from '@/app/(auth)/_components/AuthShell';
import { SketchSignInForm } from '@/app/(auth)/_components/SketchSignInForm';
import { getOrganizationCount } from '@/lib/marketing/orgCount';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your Bayaan account',
};

export default async function LoginPage() {
  const organizationCount = await getOrganizationCount();
  return (
    <AuthShell mode="signin" organizationCount={organizationCount}>
      <SketchSignInForm />
    </AuthShell>
  );
}
