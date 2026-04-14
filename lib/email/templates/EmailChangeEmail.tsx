import { Link, Section, Text } from '@react-email/components';
import { EmailLayout, styles } from './_layout';

interface EmailChangeEmailProps {
  userName?: string;
  newEmail: string;
  oldEmail: string;
  confirmationUrl: string;
  /**
   * Which side of the change this email is being sent to:
   * - 'new': sent to the new email address (confirms ownership)
   * - 'current': sent to the old email address (security notice)
   */
  recipient: 'new' | 'current';
}

export function EmailChangeEmail({
  userName,
  newEmail,
  oldEmail,
  confirmationUrl,
  recipient,
}: EmailChangeEmailProps) {
  const isNewAddress = recipient === 'new';

  return (
    <EmailLayout
      preview={
        isNewAddress
          ? 'Confirm your new Bayaan Classroom email address'
          : 'Your Bayaan Classroom email address is being changed'
      }
      heading={isNewAddress ? 'Confirm your new email' : 'Email change requested'}
    >
      <Text style={styles.text}>{userName ? `Hi ${userName},` : 'Hi,'}</Text>

      <Text style={styles.text}>
        {isNewAddress
          ? 'We received a request to change the email on your Bayaan Classroom account. Click the button below to confirm this is your new email address.'
          : 'A request was made to change the email address on your Bayaan Classroom account. We&apos;re notifying both the old and new addresses for security.'}
      </Text>

      <Section style={styles.infoBox}>
        <Text style={styles.infoText}>
          <strong>From:</strong> {oldEmail}
          <br />
          <strong>To:</strong> {newEmail}
        </Text>
      </Section>

      {isNewAddress && (
        <>
          <Link href={confirmationUrl} style={styles.button}>
            Confirm new email
          </Link>

          <Text style={styles.textMuted}>
            Or copy and paste this URL into your browser:
          </Text>
          <Link href={confirmationUrl} style={styles.linkText}>
            {confirmationUrl}
          </Link>
        </>
      )}

      <Section style={styles.warningBox}>
        <Text style={styles.warningText}>
          {isNewAddress
            ? "If you didn't request this change, do not click the link and contact support immediately."
            : "If you didn't request this change, contact support immediately — your account may be at risk."}
        </Text>
      </Section>
    </EmailLayout>
  );
}

EmailChangeEmail.PreviewProps = {
  userName: 'Ahmed',
  oldEmail: 'ahmed@old-example.com',
  newEmail: 'ahmed@new-example.com',
  confirmationUrl: 'https://bayaan.app/api/auth/confirm?token_hash=preview&type=email_change&next=/dashboard',
  recipient: 'new',
} satisfies EmailChangeEmailProps;

export default EmailChangeEmail;
