import { Metadata } from 'next';
import { AuthShell } from '@/app/(auth)/_components/AuthShell';
import { SketchSignUpForm } from '@/app/(auth)/_components/SketchSignUpForm';
import { getOrganizationCount } from '@/lib/marketing/orgCount';

export const metadata: Metadata = {
  title: 'Create account',
  description: 'Create your Bayaan account',
};

export default async function SignupPage() {
  const organizationCount = await getOrganizationCount();
  return (
    <AuthShell mode="signup" organizationCount={organizationCount}>
      <SketchSignUpForm />
    </AuthShell>
  );
}
