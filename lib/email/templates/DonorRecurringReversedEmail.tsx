import { Section, Text } from '@react-email/components';
import { DonorEmailLayout, donorStyles } from './_donor-layout';

interface DonorRecurringReversedEmailProps {
  donorName: string;
  mosqueName: string;
  amount: string; // pre-formatted, e.g. "€10.00"
  campaignTitle: string;
  processDate: string;
}

export function DonorRecurringReversedEmail({
  donorName,
  mosqueName,
  amount,
  campaignTitle,
  processDate,
}: DonorRecurringReversedEmailProps) {
  return (
    <DonorEmailLayout
      preview={`Your ${amount} donation to ${mosqueName} was reversed`}
      heading="Your donation was reversed ↩️"
      mosqueName={mosqueName}
    >
      <Text style={donorStyles.text}>Hi {donorName},</Text>

      <Text style={donorStyles.text}>
        A recurring SEPA collection to <strong>{mosqueName}</strong> has been
        reversed — either by you or by your bank. The amount has been credited
        back to your account.
      </Text>

      <Section style={donorStyles.receiptBox}>
        <Text style={donorStyles.receiptRow}>
          <strong>Amount:</strong> {amount}
        </Text>
        <Text style={donorStyles.receiptRow}>
          <strong>Campaign:</strong> {campaignTitle}
        </Text>
        <Text style={donorStyles.receiptRow}>
          <strong>Collected on:</strong> {processDate}
        </Text>
      </Section>

      <Section style={donorStyles.warningBox}>
        <Text style={donorStyles.warningText}>
          Your mandate is still active, so next month&apos;s donation will be
          attempted as normal. If you&apos;d like to pause or cancel, just reply
          to this email.
        </Text>
      </Section>

      <Text style={donorStyles.textMuted}>
        If the reversal was not intentional, check with your bank — insufficient
        funds is the most common cause.
      </Text>
    </DonorEmailLayout>
  );
}

DonorRecurringReversedEmail.PreviewProps = {
  donorName: 'Yusuf',
  mosqueName: 'Al-Noor Mosque',
  amount: '€10.00',
  campaignTitle: 'General sadaqah',
  processDate: 'April 12, 2026',
} satisfies DonorRecurringReversedEmailProps;

export default DonorRecurringReversedEmail;
