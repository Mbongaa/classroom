import { Link, Section, Text } from '@react-email/components';
import { EmailLayout, styles } from './_layout';

interface TrialEndingEmailProps {
  userName: string;
  organizationName: string;
  planName: string;
  trialEndDate: string; // pre-formatted, e.g. "April 21, 2026"
  amount: string; // pre-formatted, e.g. "€29.00"
  hasPaymentMethod: boolean; // false = user never added a card
  billingPortalUrl: string;
}

export function TrialEndingEmail({
  userName,
  organizationName,
  planName,
  trialEndDate,
  amount,
  hasPaymentMethod,
  billingPortalUrl,
}: TrialEndingEmailProps) {
  return (
    <EmailLayout
      preview={`Your Bayaan trial ends on ${trialEndDate}`}
      heading="Your trial ends soon ⏳"
    >
      <Text style={styles.text}>Hi {userName},</Text>

      <Text style={styles.text}>
        Your <strong>{planName}</strong> trial for{' '}
        <strong>{organizationName}</strong> ends on <strong>{trialEndDate}</strong>.
      </Text>

      <Section style={styles.infoBox}>
        <Text style={styles.infoText}>
          <strong>Plan:</strong> {planName}
          <br />
          <strong>Trial ends:</strong> {trialEndDate}
          <br />
          <strong>Then:</strong> {amount} / month
        </Text>
      </Section>

      {hasPaymentMethod ? (
        <Text style={styles.text}>
          We&apos;ll automatically charge the card on file on {trialEndDate} and
          your subscription will continue seamlessly.
        </Text>
      ) : (
        <Section style={styles.warningBox}>
          <Text style={styles.warningText}>
            You haven&apos;t added a payment method yet. Add one before{' '}
            {trialEndDate} to keep your subscription active — otherwise
            {' '}{organizationName} will drop to the free tier.
          </Text>
        </Section>
      )}

      <Link href={billingPortalUrl} style={styles.button}>
        {hasPaymentMethod ? 'Manage subscription' : 'Add payment method'}
      </Link>

      <Text style={styles.textMuted}>
        Not ready to continue? You can cancel from the billing portal at any
        time before {trialEndDate} — no charge will be made.
      </Text>
    </EmailLayout>
  );
}

TrialEndingEmail.PreviewProps = {
  userName: 'Ahmed',
  organizationName: 'Al-Noor Mosque',
  planName: 'Pro',
  trialEndDate: 'April 21, 2026',
  amount: '€29.00',
  hasPaymentMethod: true,
  billingPortalUrl: 'https://bayaan.ai/dashboard/billing',
} satisfies TrialEndingEmailProps;

export default TrialEndingEmail;
