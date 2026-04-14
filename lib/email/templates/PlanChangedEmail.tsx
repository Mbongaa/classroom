import { Link, Section, Text } from '@react-email/components';
import { EmailLayout, styles } from './_layout';

interface PlanChangedEmailProps {
  userName: string;
  organizationName: string;
  oldPlanName: string;
  newPlanName: string;
  effectiveDate: string;
  nextBillingDate: string;
  billingPortalUrl: string;
}

export function PlanChangedEmail({
  userName,
  organizationName,
  oldPlanName,
  newPlanName,
  effectiveDate,
  nextBillingDate,
  billingPortalUrl,
}: PlanChangedEmailProps) {
  return (
    <EmailLayout
      preview={`Your plan changed to ${newPlanName}`}
      heading="Plan updated 🔄"
    >
      <Text style={styles.text}>Hi {userName},</Text>

      <Text style={styles.text}>
        We&apos;ve updated the plan on <strong>{organizationName}</strong>.
      </Text>

      <Section style={styles.infoBox}>
        <Text style={styles.infoText}>
          <strong>Previous plan:</strong> {oldPlanName}
          <br />
          <strong>New plan:</strong> {newPlanName}
          <br />
          <strong>Effective:</strong> {effectiveDate}
          <br />
          <strong>Next billing date:</strong> {nextBillingDate}
        </Text>
      </Section>

      <Link href={billingPortalUrl} style={styles.button}>
        Manage subscription
      </Link>

      <Text style={styles.textMuted}>
        Any prorated charges or credits will appear on your next invoice.
      </Text>
    </EmailLayout>
  );
}

PlanChangedEmail.PreviewProps = {
  userName: 'Ahmed',
  organizationName: 'Al-Noor Mosque',
  oldPlanName: 'Starter',
  newPlanName: 'Pro',
  effectiveDate: 'April 14, 2026',
  nextBillingDate: 'May 14, 2026',
  billingPortalUrl: 'https://bayaan.ai/dashboard/billing',
} satisfies PlanChangedEmailProps;

export default PlanChangedEmail;
