import { Section, Text } from '@react-email/components';
import { DonorEmailLayout, Hr, donorStyles } from './_donor-layout';

interface DonorMandateAmountChangedEmailProps {
  donorName: string;
  mosqueName: string;
  oldAmount: string; // pre-formatted
  newAmount: string; // pre-formatted
  campaignTitle: string;
}

/**
 * Sent immediately when a donor changes the monthly amount via the
 * /donate/manage/[token] page. Acts as both confirmation and "wasn't
 * you?" alert in case the magic link was forwarded or compromised.
 */
export function DonorMandateAmountChangedEmail({
  donorName,
  mosqueName,
  oldAmount,
  newAmount,
  campaignTitle,
}: DonorMandateAmountChangedEmailProps) {
  return (
    <DonorEmailLayout
      preview={`Your donation to ${mosqueName} is now ${newAmount}/month`}
      heading="Monthly amount updated"
      mosqueName={mosqueName}
    >
      <Text style={donorStyles.text}>Hi {donorName},</Text>

      <Text style={donorStyles.text}>
        Your monthly donation to <strong>{mosqueName}</strong> for{' '}
        <em>{campaignTitle}</em> has been updated.
      </Text>

      <Section style={donorStyles.receiptBox}>
        <Text style={donorStyles.receiptRow}>Previous amount</Text>
        <Text style={donorStyles.receiptRow}>{oldAmount}</Text>
        <Text style={donorStyles.receiptRow}>New amount</Text>
        <Text style={donorStyles.amountLarge}>{newAmount}</Text>
      </Section>

      <Hr style={{ borderColor: '#E7E2D6', margin: '24px 0' }} />

      <Text style={donorStyles.textMuted}>
        The new amount applies from your next monthly debit. If you
        didn&rsquo;t make this change, reply to this email immediately and
        we&rsquo;ll restore the previous amount.
      </Text>
    </DonorEmailLayout>
  );
}

DonorMandateAmountChangedEmail.PreviewProps = {
  donorName: 'Yusuf',
  mosqueName: 'Al-Noor Mosque',
  oldAmount: '€10.00',
  newAmount: '€25.00',
  campaignTitle: 'General sadaqah',
} satisfies DonorMandateAmountChangedEmailProps;

export default DonorMandateAmountChangedEmail;
