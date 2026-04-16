import { Section, Text } from '@react-email/components';
import { DonorEmailLayout, Hr, donorStyles } from './_donor-layout';

interface DonationRefundedEmailProps {
  donorName: string;
  mosqueName: string;
  amount: string;
  campaignTitle: string;
  refundDate: string;
  orderReference: string;
}

export function DonationRefundedEmail({
  donorName,
  mosqueName,
  amount,
  campaignTitle,
  refundDate,
  orderReference,
}: DonationRefundedEmailProps) {
  return (
    <DonorEmailLayout
      preview={`Your ${amount} donation to ${mosqueName} has been refunded`}
      heading={`Refund processed`}
      mosqueName={mosqueName}
    >
      <Text style={donorStyles.text}>Hi {donorName},</Text>

      <Text style={donorStyles.text}>
        Your donation of <strong>{amount}</strong> to{' '}
        <strong>{mosqueName}</strong> has been refunded.
      </Text>

      <Section style={donorStyles.receiptBox}>
        <Text style={donorStyles.receiptRow}>Refund amount</Text>
        <Text style={donorStyles.amountLarge}>{amount}</Text>
      </Section>

      <Section style={donorStyles.receiptBox}>
        <Text style={donorStyles.receiptRow}>
          <strong>Campaign:</strong> {campaignTitle}
        </Text>
        <Text style={donorStyles.receiptRow}>
          <strong>Refund date:</strong> {refundDate}
        </Text>
        <Text style={donorStyles.receiptRow}>
          <strong>Reference:</strong> {orderReference}
        </Text>
      </Section>

      <Hr style={{ borderColor: '#E7E2D6', margin: '24px 0' }} />

      <Text style={donorStyles.textMuted}>
        The funds should appear in your account within 5–10 business days,
        depending on your bank. If you have questions, reply to this email.
      </Text>
    </DonorEmailLayout>
  );
}

DonationRefundedEmail.PreviewProps = {
  donorName: 'Fatima',
  mosqueName: 'Al-Noor Mosque',
  amount: '€25.00',
  campaignTitle: 'Ramadan iftar fund',
  refundDate: 'April 16, 2026',
  orderReference: '52028325014X23cb',
} satisfies DonationRefundedEmailProps;

export default DonationRefundedEmail;
