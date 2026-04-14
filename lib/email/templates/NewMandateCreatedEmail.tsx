import { Link, Section, Text } from '@react-email/components';
import { EmailLayout, styles } from './_layout';

interface NewMandateCreatedEmailProps {
  userName: string;
  organizationName: string;
  donorName: string;
  monthlyAmount: string; // pre-formatted, e.g. "€10.00"
  campaignTitle: string;
  firstDebitDate: string; // when Pay.nl will pull the first debit
  dashboardUrl: string;
}

export function NewMandateCreatedEmail({
  userName,
  organizationName,
  donorName,
  monthlyAmount,
  campaignTitle,
  firstDebitDate,
  dashboardUrl,
}: NewMandateCreatedEmailProps) {
  return (
    <EmailLayout
      preview={`${donorName} set up ${monthlyAmount}/month recurring for ${organizationName}`}
      heading="New recurring donor 🔁"
    >
      <Text style={styles.text}>Hi {userName},</Text>

      <Text style={styles.text}>
        <strong>{donorName}</strong> just set up a recurring SEPA donation for{' '}
        <strong>{organizationName}</strong>.
      </Text>

      <Section style={styles.infoBox}>
        <Text style={styles.infoText}>
          <strong>Donor:</strong> {donorName}
          <br />
          <strong>Monthly amount:</strong> {monthlyAmount}
          <br />
          <strong>Campaign:</strong> {campaignTitle}
          <br />
          <strong>First debit:</strong> {firstDebitDate}
        </Text>
      </Section>

      <Link href={dashboardUrl} style={styles.button}>
        View recurring donors
      </Link>

      <Text style={styles.textMuted}>
        The mandate becomes active the first time the debit is collected. We&apos;ll
        let you know if a future collection is reversed.
      </Text>
    </EmailLayout>
  );
}

NewMandateCreatedEmail.PreviewProps = {
  userName: 'Ahmed',
  organizationName: 'Al-Noor Mosque',
  donorName: 'Yusuf K.',
  monthlyAmount: '€10.00',
  campaignTitle: 'General sadaqah',
  firstDebitDate: 'April 21, 2026',
  dashboardUrl: 'https://bayaan.ai/dashboard/donations/recurring',
} satisfies NewMandateCreatedEmailProps;

export default NewMandateCreatedEmail;
