import { Link, Section, Text } from '@react-email/components';
import { EmailLayout, styles } from './_layout';

interface PasswordResetEmailProps {
  userName?: string;
  resetUrl: string;
}

export function PasswordResetEmail({ userName, resetUrl }: PasswordResetEmailProps) {
  return (
    <EmailLayout
      preview="Reset your Bayaan Classroom password"
      heading="Reset your password"
    >
      <Text style={styles.text}>{userName ? `Hi ${userName},` : 'Hi,'}</Text>

      <Text style={styles.text}>
        We received a request to reset the password for your Bayaan Classroom account.
        Click the button below to choose a new password.
      </Text>

      <Link href={resetUrl} style={styles.button}>
        Reset password
      </Link>

      <Text style={styles.textMuted}>
        Or copy and paste this URL into your browser:
      </Text>
      <Link href={resetUrl} style={styles.linkText}>
        {resetUrl}
      </Link>

      <Section style={styles.warningBox}>
        <Text style={styles.warningText}>
          This link will expire in 1 hour. If you didn&apos;t request a password reset,
          you can safely ignore this email — your password won&apos;t change.
        </Text>
      </Section>
    </EmailLayout>
  );
}

PasswordResetEmail.PreviewProps = {
  userName: 'Ahmed',
  resetUrl: 'https://bayaan.app/api/auth/confirm?token_hash=preview&type=recovery&next=/reset-password',
} satisfies PasswordResetEmailProps;

export default PasswordResetEmail;
