import { Link, Section, Text } from '@react-email/components';
import { EmailLayout, styles } from './_layout';

interface UpcomingInvoiceEmailProps {
  userName: string;
  organizationName: string;
  planName: string;
  amount: string; // pre-formatted, e.g. "€29.00"
  billingDate: string; // pre-formatted, e.g. "April 21, 2026"
  cardBrand?: string; // "Visa" etc.
  last4?: string;
  billingPortalUrl: string;
}

export function UpcomingInvoiceEmail({
  userName,
  organizationName,
  planName,
  amount,
  billingDate,
  cardBrand,
  last4,
  billingPortalUrl,
}: UpcomingInvoiceEmailProps) {
  const paymentLine =
    cardBrand && last4 ? `${cardBrand} ending ${last4}` : 'your card on file';

  return (
    <EmailLayout
      preview={`Heads up — ${amount} will be charged on ${billingDate}`}
      heading="Upcoming charge 📅"
    >
      <Text style={styles.text}>Hi {userName},</Text>

      <Text style={styles.text}>
        This is a heads-up that your next invoice for{' '}
        <strong>{organizationName}</strong> will be charged in a few days.
      </Text>

      <Section style={styles.infoBox}>
        <Text style={styles.infoText}>
          <strong>Plan:</strong> {planName}
          <br />
          <strong>Amount:</strong> {amount}
          <br />
          <strong>Date:</strong> {billingDate}
          <br />
          <strong>Payment:</strong> {paymentLine}
        </Text>
      </Section>

      <Text style={styles.text}>
        No action needed — we&apos;ll charge {paymentLine} automatically.
      </Text>

      <Link href={billingPortalUrl} style={styles.button}>
        Manage subscription
      </Link>

      <Text style={styles.textMuted}>
        Want to change your plan or payment method? Do it from the billing
        portal before {billingDate}.
      </Text>
    </EmailLayout>
  );
}

UpcomingInvoiceEmail.PreviewProps = {
  userName: 'Ahmed',
  organizationName: 'Al-Noor Mosque',
  planName: 'Pro',
  amount: '€29.00',
  billingDate: 'April 21, 2026',
  cardBrand: 'Visa',
  last4: '4242',
  billingPortalUrl: 'https://bayaan.ai/dashboard/billing',
} satisfies UpcomingInvoiceEmailProps;

export default UpcomingInvoiceEmail;
