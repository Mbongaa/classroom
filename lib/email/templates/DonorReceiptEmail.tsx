import { Section, Text } from '@react-email/components';
import { DonorEmailLayout, Hr, donorStyles } from './_donor-layout';

interface DonorReceiptEmailProps {
  donorName: string;
  mosqueName: string;
  amount: string; // pre-formatted, e.g. "€25.00"
  campaignTitle: string;
  paidDate: string;
  paymentMethod: string; // "iDEAL", "Card", "Bancontact", etc.
  orderReference: string; // Pay.nl order id
}

export function DonorReceiptEmail({
  donorName,
  mosqueName,
  amount,
  campaignTitle,
  paidDate,
  paymentMethod,
  orderReference,
}: DonorReceiptEmailProps) {
  return (
    <DonorEmailLayout
      preview={`Your ${amount} donation to ${mosqueName} — thank you`}
      heading={`Thank you, ${donorName} 🤲`}
      mosqueName={mosqueName}
    >
      <Text style={donorStyles.text}>
        Your gift has been received by <strong>{mosqueName}</strong>. May it be
        counted among your best deeds.
      </Text>

      <Section style={donorStyles.receiptBox}>
        <Text style={donorStyles.receiptRow}>Amount</Text>
        <Text style={donorStyles.amountLarge}>{amount}</Text>
      </Section>

      <Section style={donorStyles.receiptBox}>
        <Text style={donorStyles.receiptRow}>
          <strong>Campaign:</strong> {campaignTitle}
        </Text>
        <Text style={donorStyles.receiptRow}>
          <strong>Date:</strong> {paidDate}
        </Text>
        <Text style={donorStyles.receiptRow}>
          <strong>Method:</strong> {paymentMethod}
        </Text>
        <Text style={donorStyles.receiptRow}>
          <strong>Reference:</strong> {orderReference}
        </Text>
      </Section>

      <Hr style={{ borderColor: '#E7E2D6', margin: '24px 0' }} />

      <Text style={donorStyles.textMuted}>
        Please keep this email — it serves as your receipt. If you need a formal
        ANBI-compliant receipt for tax purposes, just reply to this email.
      </Text>
    </DonorEmailLayout>
  );
}

DonorReceiptEmail.PreviewProps = {
  donorName: 'Fatima',
  mosqueName: 'Al-Noor Mosque',
  amount: '€25.00',
  campaignTitle: 'Ramadan iftar fund',
  paidDate: 'April 14, 2026',
  paymentMethod: 'iDEAL',
  orderReference: '52028325014X23cb',
} satisfies DonorReceiptEmailProps;

export default DonorReceiptEmail;
