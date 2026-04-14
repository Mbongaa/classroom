import { Section, Text } from '@react-email/components';
import { DonorEmailLayout, Hr, donorStyles } from './_donor-layout';

interface DonorRecurringActivatedEmailProps {
  donorName: string;
  mosqueName: string;
  monthlyAmount: string; // pre-formatted, e.g. "€10.00"
  campaignTitle: string;
  firstDebitDate: string;
  mandateReference: string; // Pay.nl mandate id (IO-XXXX-XXXX-XXXX)
}

export function DonorRecurringActivatedEmail({
  donorName,
  mosqueName,
  monthlyAmount,
  campaignTitle,
  firstDebitDate,
  mandateReference,
}: DonorRecurringActivatedEmailProps) {
  return (
    <DonorEmailLayout
      preview={`Your ${monthlyAmount}/month to ${mosqueName} is active`}
      heading="Your recurring donation is active 🔁"
      mosqueName={mosqueName}
    >
      <Text style={donorStyles.text}>Hi {donorName},</Text>

      <Text style={donorStyles.text}>
        Your SEPA mandate with <strong>{mosqueName}</strong> is now active. Your
        first donation has been collected — thank you.
      </Text>

      <Section style={donorStyles.receiptBox}>
        <Text style={donorStyles.receiptRow}>Monthly amount</Text>
        <Text style={donorStyles.amountLarge}>{monthlyAmount}</Text>
      </Section>

      <Section style={donorStyles.receiptBox}>
        <Text style={donorStyles.receiptRow}>
          <strong>Campaign:</strong> {campaignTitle}
        </Text>
        <Text style={donorStyles.receiptRow}>
          <strong>First debit:</strong> {firstDebitDate}
        </Text>
        <Text style={donorStyles.receiptRow}>
          <strong>Mandate:</strong> {mandateReference}
        </Text>
      </Section>

      <Hr style={{ borderColor: '#E7E2D6', margin: '24px 0' }} />

      <Text style={donorStyles.textMuted}>
        Your donation will be collected on the same day each month. You can
        cancel anytime by replying to this email — there&apos;s no penalty and
        the mandate ends immediately.
      </Text>

      <Text style={donorStyles.textMuted}>
        Under SEPA rules you can also request a refund from your bank for up to
        eight weeks after any collection, no questions asked.
      </Text>
    </DonorEmailLayout>
  );
}

DonorRecurringActivatedEmail.PreviewProps = {
  donorName: 'Yusuf',
  mosqueName: 'Al-Noor Mosque',
  monthlyAmount: '€10.00',
  campaignTitle: 'General sadaqah',
  firstDebitDate: 'April 14, 2026',
  mandateReference: 'IO-1234-5678-9012',
} satisfies DonorRecurringActivatedEmailProps;

export default DonorRecurringActivatedEmail;
