import { Link, Text } from '@react-email/components';
import { EmailLayout, styles } from './_layout';

interface ConfirmSignupEmailProps {
  userName?: string;
  confirmationUrl: string;
}

export function ConfirmSignupEmail({ userName, confirmationUrl }: ConfirmSignupEmailProps) {
  return (
    <EmailLayout
      preview="Confirm your email to activate your Bayaan Classroom account"
      heading="Confirm your email"
    >
      <Text style={styles.text}>{userName ? `Hi ${userName},` : 'Hi,'}</Text>

      <Text style={styles.text}>
        Welcome to Bayaan Classroom! Click the button below to confirm your email address
        and activate your account.
      </Text>

      <Link href={confirmationUrl} style={styles.button}>
        Confirm email
      </Link>

      <Text style={styles.textMuted}>
        Or copy and paste this URL into your browser:
      </Text>
      <Link href={confirmationUrl} style={styles.linkText}>
        {confirmationUrl}
      </Link>

      <div style={{ marginTop: '16px' }}>
        <Text style={styles.textMuted}>
          If you didn&apos;t create a Bayaan Classroom account, you can safely ignore this email.
        </Text>
      </div>
    </EmailLayout>
  );
}

ConfirmSignupEmail.PreviewProps = {
  userName: 'Ahmed',
  confirmationUrl: 'https://bayaan.app/api/auth/confirm?token_hash=preview&type=signup&next=/dashboard',
} satisfies ConfirmSignupEmailProps;

export default ConfirmSignupEmail;
