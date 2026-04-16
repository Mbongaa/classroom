import { Link, Section, Text } from '@react-email/components';
import { EmailLayout, styles } from './_layout';

interface ChargebackAlertEmailProps {
  userName: string;
  organizationName: string;
  amount: string;
  donorName: string;
  campaignTitle: string;
  paidDate: string;
  dashboardUrl: string;
}

export function ChargebackAlertEmail({
  userName,
  organizationName,
  amount,
  donorName,
  campaignTitle,
  paidDate,
  dashboardUrl,
}: ChargebackAlertEmailProps) {
  return (
    <EmailLayout
      preview={`Chargeback: ${amount} donation from ${donorName} was disputed`}
      heading="Chargeback received ⚠️"
    >
      <Text style={styles.text}>Hi {userName},</Text>

      <Text style={styles.text}>
        A chargeback has been filed against a donation to{' '}
        <strong>{organizationName}</strong>. The donor&apos;s bank has reversed
        the payment.
      </Text>

      <Section style={styles.warningBox}>
        <Text style={styles.warningText}>
          This is different from a regular cancellation. The {amount} will be
          deducted from your next payout. Repeated chargebacks may result in
          penalty fees from Pay.nl.
        </Text>
      </Section>

      <Section style={styles.infoBox}>
        <Text style={styles.infoText}>
          <strong>Amount:</strong> {amount}
          <br />
          <strong>Donor:</strong> {donorName}
          <br />
          <strong>Campaign:</strong> {campaignTitle}
          <br />
          <strong>Originally paid:</strong> {paidDate}
        </Text>
      </Section>

      <Link href={dashboardUrl} style={styles.button}>
        View donations
      </Link>

      <Text style={styles.textMuted}>
        If you believe this chargeback is fraudulent, contact Pay.nl support
        with the transaction details.
      </Text>
    </EmailLayout>
  );
}

ChargebackAlertEmail.PreviewProps = {
  userName: 'Ahmed',
  organizationName: 'Al-Noor Mosque',
  amount: '€50.00',
  donorName: 'Fatima B.',
  campaignTitle: 'Ramadan iftar fund',
  paidDate: 'April 10, 2026',
  dashboardUrl: 'https://bayaan.ai/dashboard/donations',
} satisfies ChargebackAlertEmailProps;

export default ChargebackAlertEmail;
