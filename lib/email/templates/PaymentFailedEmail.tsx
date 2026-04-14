import { Link, Section, Text } from '@react-email/components';
import { EmailLayout, styles } from './_layout';

interface PaymentFailedEmailProps {
  userName: string;
  organizationName: string;
  planName: string;
  amount: string; // pre-formatted, e.g. "€29.00"
  failureReason?: string; // optional Stripe decline reason
  nextRetryDate?: string; // when Stripe will retry
  updatePaymentUrl: string; // billing portal URL
}

export function PaymentFailedEmail({
  userName,
  organizationName,
  planName,
  amount,
  failureReason,
  nextRetryDate,
  updatePaymentUrl,
}: PaymentFailedEmailProps) {
  return (
    <EmailLayout
      preview={`Payment failed for ${organizationName} — please update your card`}
      heading="Payment failed ⚠️"
    >
      <Text style={styles.text}>Hi {userName},</Text>

      <Text style={styles.text}>
        We weren&apos;t able to charge your card for the <strong>{planName}</strong> plan
        on <strong>{organizationName}</strong>. Your subscription is still active for now,
        but service may be paused if we can&apos;t collect payment soon.
      </Text>

      <Section style={styles.infoBox}>
        <Text style={styles.infoText}>
          <strong>Amount:</strong> {amount}
          {failureReason && (
            <>
              <br />
              <strong>Reason:</strong> {failureReason}
            </>
          )}
          {nextRetryDate && (
            <>
              <br />
              <strong>Next retry:</strong> {nextRetryDate}
            </>
          )}
        </Text>
      </Section>

      <Link href={updatePaymentUrl} style={styles.button}>
        Update payment method
      </Link>

      <Section style={styles.warningBox}>
        <Text style={styles.warningText}>
          To avoid an interruption, please update your card details within the next
          few days. We&apos;ll keep retrying automatically.
        </Text>
      </Section>
    </EmailLayout>
  );
}

PaymentFailedEmail.PreviewProps = {
  userName: 'Ahmed',
  organizationName: 'Al-Noor Mosque',
  planName: 'Pro',
  amount: '€29.00',
  failureReason: 'Your card was declined.',
  nextRetryDate: 'April 17, 2026',
  updatePaymentUrl: 'https://bayaan.ai/dashboard/billing',
} satisfies PaymentFailedEmailProps;

export default PaymentFailedEmail;
