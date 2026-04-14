import { Link, Section, Text } from '@react-email/components';
import { EmailLayout, styles } from './_layout';

interface MagicLinkEmailProps {
  userName?: string;
  magicLinkUrl: string;
}

export function MagicLinkEmail({ userName, magicLinkUrl }: MagicLinkEmailProps) {
  return (
    <EmailLayout
      preview="Your sign-in link for Bayaan Classroom"
      heading="Sign in to Bayaan Classroom"
    >
      <Text style={styles.text}>{userName ? `Hi ${userName},` : 'Hi,'}</Text>

      <Text style={styles.text}>
        Click the button below to sign in to your Bayaan Classroom account. This link
        will sign you in without a password.
      </Text>

      <Link href={magicLinkUrl} style={styles.button}>
        Sign in
      </Link>

      <Text style={styles.textMuted}>
        Or copy and paste this URL into your browser:
      </Text>
      <Link href={magicLinkUrl} style={styles.linkText}>
        {magicLinkUrl}
      </Link>

      <Section style={styles.warningBox}>
        <Text style={styles.warningText}>
          This link will expire in 1 hour and can only be used once. If you didn&apos;t
          request a sign-in link, you can safely ignore this email.
        </Text>
      </Section>
    </EmailLayout>
  );
}

MagicLinkEmail.PreviewProps = {
  userName: 'Ahmed',
  magicLinkUrl: 'https://bayaan.app/api/auth/confirm?token_hash=preview&type=magiclink&next=/dashboard',
} satisfies MagicLinkEmailProps;

export default MagicLinkEmail;
