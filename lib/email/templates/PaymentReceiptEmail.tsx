import { Link, Section, Text } from '@react-email/components';
import { EmailLayout, Hr, styles } from './_layout';

interface PaymentReceiptEmailProps {
  userName: string;
  organizationName: string;
  planName: string;
  amount: string; // pre-formatted with currency, e.g. "€29.00"
  invoiceNumber: string;
  invoiceDate: string;
  nextBillingDate: string;
  hostedInvoiceUrl?: string; // Stripe-hosted invoice / PDF link
  billingPortalUrl: string;
}

export function PaymentReceiptEmail({
  userName,
  organizationName,
  planName,
  amount,
  invoiceNumber,
  invoiceDate,
  nextBillingDate,
  hostedInvoiceUrl,
  billingPortalUrl,
}: PaymentReceiptEmailProps) {
  return (
    <EmailLayout
      preview={`Payment received — ${amount}`}
      heading="Payment received ✅"
    >
      <Text style={styles.text}>Hi {userName},</Text>

      <Text style={styles.text}>
        Thanks for your payment. Your <strong>{planName}</strong> plan for{' '}
        <strong>{organizationName}</strong> has been renewed.
      </Text>

      <Section style={styles.infoBox}>
        <Text style={styles.infoText}>
          <strong>Amount:</strong> {amount}
          <br />
          <strong>Invoice:</strong> {invoiceNumber}
          <br />
          <strong>Date:</strong> {invoiceDate}
          <br />
          <strong>Next billing date:</strong> {nextBillingDate}
        </Text>
      </Section>

      {hostedInvoiceUrl && (
        <Link href={hostedInvoiceUrl} style={styles.button}>
          View invoice
        </Link>
      )}

      <Hr style={{ borderColor: 'rgba(255,255,255,0.08)', margin: '24px 0' }} />

      <Text style={styles.textMuted}>
        Manage your subscription or update payment details:
      </Text>
      <Link href={billingPortalUrl} style={styles.linkText}>
        Billing portal
      </Link>
    </EmailLayout>
  );
}

PaymentReceiptEmail.PreviewProps = {
  userName: 'Ahmed',
  organizationName: 'Al-Noor Mosque',
  planName: 'Pro',
  amount: '€29.00',
  invoiceNumber: 'INV-2026-0412',
  invoiceDate: 'April 14, 2026',
  nextBillingDate: 'May 14, 2026',
  hostedInvoiceUrl: 'https://invoice.stripe.com/i/preview',
  billingPortalUrl: 'https://bayaan.ai/dashboard/billing',
} satisfies PaymentReceiptEmailProps;

export default PaymentReceiptEmail;
