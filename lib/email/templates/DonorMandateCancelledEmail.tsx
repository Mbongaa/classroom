import { Section, Text } from '@react-email/components';
import { DonorEmailLayout, Hr, donorStyles } from './_donor-layout';

interface DonorMandateCancelledEmailProps {
  donorName: string;
  mosqueName: string;
  campaignTitle: string;
}

/**
 * Confirmation when a donor cancels their recurring mandate from the
 * /donate/manage/[token] page. No more debits will be processed.
 */
export function DonorMandateCancelledEmail({
  donorName,
  mosqueName,
  campaignTitle,
}: DonorMandateCancelledEmailProps) {
  return (
    <DonorEmailLayout
      preview={`Your recurring donation to ${mosqueName} has been cancelled`}
      heading="Recurring donation cancelled"
      mosqueName={mosqueName}
    >
      <Text style={donorStyles.text}>Hi {donorName},</Text>

      <Text style={donorStyles.text}>
        Your recurring donation to <strong>{mosqueName}</strong> for{' '}
        <em>{campaignTitle}</em> has been cancelled. No further debits will
        be processed against this mandate.
      </Text>

      <Section style={donorStyles.receiptBox}>
        <Text style={donorStyles.receiptRow}>
          May Allah ﷻ accept your past donations and grant you barakah for
          your generosity.
        </Text>
      </Section>

      <Hr style={{ borderColor: '#E7E2D6', margin: '24px 0' }} />

      <Text style={donorStyles.textMuted}>
        If you didn&rsquo;t cancel this yourself, reply to this email
        immediately and we&rsquo;ll investigate. Setting up a new mandate
        takes a minute and starts fresh — you&rsquo;re welcome any time.
      </Text>
    </DonorEmailLayout>
  );
}

DonorMandateCancelledEmail.PreviewProps = {
  donorName: 'Yusuf',
  mosqueName: 'Al-Noor Mosque',
  campaignTitle: 'General sadaqah',
} satisfies DonorMandateCancelledEmailProps;

export default DonorMandateCancelledEmail;
