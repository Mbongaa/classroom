import { Metadata } from 'next';
import { AuthShell } from '@/app/(auth)/_components/AuthShell';
import { SketchSignUpForm } from '@/app/(auth)/_components/SketchSignUpForm';

export const metadata: Metadata = {
  title: 'Create account',
  description: 'Create your Bayaan account',
};

export default function SignupPage() {
  return (
    <AuthShell mode="signup">
      <SketchSignUpForm />
    </AuthShell>
  );
}
