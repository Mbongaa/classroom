import { Link, Section, Text } from '@react-email/components';
import { EmailLayout, styles } from './_layout';

interface NewDonationReceivedEmailProps {
  userName: string;
  organizationName: string;
  amount: string; // pre-formatted, e.g. "€25.00"
  donorName: string; // "Anonymous" if not provided
  campaignTitle: string; // "General donations" fallback
  paidDate: string;
  dashboardUrl: string;
}

export function NewDonationReceivedEmail({
  userName,
  organizationName,
  amount,
  donorName,
  campaignTitle,
  paidDate,
  dashboardUrl,
}: NewDonationReceivedEmailProps) {
  return (
    <EmailLayout
      preview={`${organizationName} just received ${amount} from ${donorName}`}
      heading="New donation received 💰"
    >
      <Text style={styles.text}>Hi {userName},</Text>

      <Text style={styles.text}>
        <strong>{organizationName}</strong> just received a donation.
      </Text>

      <Section style={styles.infoBox}>
        <Text style={styles.infoText}>
          <strong>Amount:</strong> {amount}
          <br />
          <strong>From:</strong> {donorName}
          <br />
          <strong>Campaign:</strong> {campaignTitle}
          <br />
          <strong>Received:</strong> {paidDate}
        </Text>
      </Section>

      <Link href={dashboardUrl} style={styles.button}>
        View in dashboard
      </Link>

      <Text style={styles.textMuted}>
        Funds are settled via Pay.nl on your normal payout schedule. Any platform
        fee has already been deducted.
      </Text>
    </EmailLayout>
  );
}

NewDonationReceivedEmail.PreviewProps = {
  userName: 'Ahmed',
  organizationName: 'Al-Noor Mosque',
  amount: '€25.00',
  donorName: 'Fatima B.',
  campaignTitle: 'Ramadan iftar fund',
  paidDate: 'April 14, 2026',
  dashboardUrl: 'https://bayaan.ai/dashboard/donations',
} satisfies NewDonationReceivedEmailProps;

export default NewDonationReceivedEmail;
