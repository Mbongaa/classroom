import { Metadata } from 'next';
import { AuthShell } from '@/app/(auth)/_components/AuthShell';
import { SketchSignInForm } from '@/app/(auth)/_components/SketchSignInForm';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your Bayaan account',
};

export default function LoginPage() {
  return (
    <AuthShell mode="signin">
      <SketchSignInForm />
    </AuthShell>
  );
}
