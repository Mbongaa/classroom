import { Link, Section, Text } from '@react-email/components';
import { EmailLayout, styles } from './_layout';

interface SubscriptionCancelledEmailProps {
  userName: string;
  organizationName: string;
  planName: string;
  /** Date the subscription stops working — leave undefined for immediate. */
  accessUntilDate?: string;
  reactivateUrl: string;
}

export function SubscriptionCancelledEmail({
  userName,
  organizationName,
  planName,
  accessUntilDate,
  reactivateUrl,
}: SubscriptionCancelledEmailProps) {
  return (
    <EmailLayout
      preview={`Your Bayaan ${planName} plan has been cancelled`}
      heading="Subscription cancelled 👋"
    >
      <Text style={styles.text}>Hi {userName},</Text>

      <Text style={styles.text}>
        We&apos;ve cancelled the <strong>{planName}</strong> plan on{' '}
        <strong>{organizationName}</strong>. Sorry to see you go.
      </Text>

      <Section style={styles.infoBox}>
        <Text style={styles.infoText}>
          {accessUntilDate ? (
            <>
              <strong>Access until:</strong> {accessUntilDate}
              <br />
              You&apos;ll keep full access until then. After that, your organization
              drops to the free tier.
            </>
          ) : (
            <>Your subscription has ended and the organization is now on the free tier.</>
          )}
        </Text>
      </Section>

      <Text style={styles.text}>
        Changed your mind? You can resubscribe anytime — your data and settings
        stay intact.
      </Text>

      <Link href={reactivateUrl} style={styles.button}>
        Reactivate subscription
      </Link>

      <Text style={styles.textMuted}>
        If you cancelled by mistake, just reply to this email and we&apos;ll help.
      </Text>
    </EmailLayout>
  );
}

SubscriptionCancelledEmail.PreviewProps = {
  userName: 'Ahmed',
  organizationName: 'Al-Noor Mosque',
  planName: 'Pro',
  accessUntilDate: 'May 14, 2026',
  reactivateUrl: 'https://bayaan.ai/dashboard/billing',
} satisfies SubscriptionCancelledEmailProps;

export default SubscriptionCancelledEmail;
