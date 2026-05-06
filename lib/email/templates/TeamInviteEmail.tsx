import { Link, Section, Text } from '@react-email/components';
import { defaultLocale, type Locale } from '@/i18n/config';
import { EmailLayout, styles } from './_layout';

interface TeamInviteEmailProps {
  organizationName: string;
  inviteUrl: string;
  roleLabel: string;
  locale?: Locale;
}

export function TeamInviteEmail({
  organizationName,
  inviteUrl,
  roleLabel,
  locale = defaultLocale,
}: TeamInviteEmailProps) {
  return (
    <EmailLayout
      preview={`You have been invited to ${organizationName} on Bayaan`}
      heading="Join your Bayaan team"
      locale={locale}
    >
      <Text style={styles.text}>
        You have been invited to join {organizationName} on Bayaan as {roleLabel}.
      </Text>

      <Text style={styles.text}>
        Use this link to accept the invitation and sign in. Bayaan will add you to the existing
        organization automatically.
      </Text>

      <Link href={inviteUrl} style={styles.button}>
        Accept invitation
      </Link>

      <Text style={styles.textMuted}>Or copy and paste this URL into your browser:</Text>
      <Link href={inviteUrl} style={styles.linkText}>
        {inviteUrl}
      </Link>

      <Section style={styles.warningBox}>
        <Text style={styles.warningText}>
          If you were not expecting this invitation, you can safely ignore this email.
        </Text>
      </Section>
    </EmailLayout>
  );
}

TeamInviteEmail.PreviewProps = {
  organizationName: 'Al Noor Mosque',
  inviteUrl: 'https://bayaan.app/api/auth/confirm?token_hash=preview&type=invite&next=/api/invitations/accept',
  roleLabel: 'Teacher (translation only)',
  locale: 'en',
} satisfies TeamInviteEmailProps;

export default TeamInviteEmail;
