import { Link, Section, Text } from '@react-email/components';
import { EmailLayout, styles } from './_layout';

interface RecurringDonationFailedEmailProps {
  userName: string;
  organizationName: string;
  donorName: string;
  amount: string; // pre-formatted, e.g. "€10.00"
  campaignTitle: string;
  processDate: string; // when the debit was attempted
  dashboardUrl: string;
}

export function RecurringDonationFailedEmail({
  userName,
  organizationName,
  donorName,
  amount,
  campaignTitle,
  processDate,
  dashboardUrl,
}: RecurringDonationFailedEmailProps) {
  return (
    <EmailLayout
      preview={`A ${amount} recurring donation from ${donorName} was reversed`}
      heading="Recurring donation reversed ⚠️"
    >
      <Text style={styles.text}>Hi {userName},</Text>

      <Text style={styles.text}>
        A recurring SEPA collection for <strong>{organizationName}</strong> was
        reversed by the donor&apos;s bank.
      </Text>

      <Section style={styles.infoBox}>
        <Text style={styles.infoText}>
          <strong>Donor:</strong> {donorName}
          <br />
          <strong>Amount:</strong> {amount}
          <br />
          <strong>Campaign:</strong> {campaignTitle}
          <br />
          <strong>Attempted:</strong> {processDate}
        </Text>
      </Section>

      <Section style={styles.warningBox}>
        <Text style={styles.warningText}>
          Pay.nl has already credited the donor. The funds will be clawed back
          from your next payout. Under SEPA rules a storno can happen up to 56
          days after collection.
        </Text>
      </Section>

      <Link href={dashboardUrl} style={styles.button}>
        View recurring donors
      </Link>

      <Text style={styles.textMuted}>
        If this keeps happening with the same donor, you can cancel the mandate
        from the dashboard — the donor can always resubscribe.
      </Text>
    </EmailLayout>
  );
}

RecurringDonationFailedEmail.PreviewProps = {
  userName: 'Ahmed',
  organizationName: 'Al-Noor Mosque',
  donorName: 'Yusuf K.',
  amount: '€10.00',
  campaignTitle: 'General sadaqah',
  processDate: 'April 12, 2026',
  dashboardUrl: 'https://bayaan.ai/dashboard/donations/recurring',
} satisfies RecurringDonationFailedEmailProps;

export default RecurringDonationFailedEmail;
