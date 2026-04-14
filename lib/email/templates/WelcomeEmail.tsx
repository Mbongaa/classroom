import { Link, Section, Text } from '@react-email/components';
import { EmailLayout, Hr, styles } from './_layout';

interface WelcomeEmailProps {
  userName: string;
  organizationName: string;
  planName: string;
  billingPeriodEnd: string;
  dashboardUrl: string;
  billingPortalUrl: string;
}

export function WelcomeEmail({
  userName,
  organizationName,
  planName,
  billingPeriodEnd,
  dashboardUrl,
  billingPortalUrl,
}: WelcomeEmailProps) {
  return (
    <EmailLayout
      preview="Welcome to Bayaan — your subscription is active"
      heading="Welcome to Bayaan 🎉"
    >
      <Text style={styles.text}>Hi {userName},</Text>

      <Text style={styles.text}>
        Thanks for subscribing. Your <strong>{planName}</strong> plan is now active and
        ready to use.
      </Text>

      <Section style={styles.infoBox}>
        <Text style={styles.infoText}>
          <strong>Organization:</strong> {organizationName}
          <br />
          <strong>Plan:</strong> {planName}
          <br />
          <strong>Next billing date:</strong> {billingPeriodEnd}
        </Text>
      </Section>

      <Link href={dashboardUrl} style={styles.button}>
        Go to dashboard
      </Link>

      <Hr style={{ borderColor: 'rgba(255,255,255,0.08)', margin: '24px 0' }} />

      <Text style={styles.textMuted}>Manage your subscription anytime:</Text>
      <Link href={billingPortalUrl} style={styles.linkText}>
        Billing portal
      </Link>
    </EmailLayout>
  );
}

WelcomeEmail.PreviewProps = {
  userName: 'Ahmed',
  organizationName: 'Al-Noor Mosque',
  planName: 'Pro',
  billingPeriodEnd: 'May 14, 2026',
  dashboardUrl: 'https://bayaan.ai/dashboard',
  billingPortalUrl: 'https://bayaan.ai/dashboard/billing',
} satisfies WelcomeEmailProps;

export default WelcomeEmail;
