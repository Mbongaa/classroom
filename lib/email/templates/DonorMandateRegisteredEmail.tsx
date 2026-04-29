import { Button, Section, Text } from '@react-email/components';
import { DonorEmailLayout, Hr, donorStyles } from './_donor-layout';

interface DonorMandateRegisteredEmailProps {
  donorName: string;
  mosqueName: string;
  monthlyAmount: string; // pre-formatted, e.g. "€10.00"
  campaignTitle: string;
  firstDebitDate: string; // e.g. "May 2, 2026"
  mandateReference: string; // Pay.nl mandate id (IO-XXXX-XXXX-XXXX)
  ibanLast4: string | null; // last 4 digits of donor's IBAN, for recall
  manageUrl: string; // /donate/manage/<token> — donor self-service portal
}

/**
 * Sent immediately when a donor finishes the recurring-donation form.
 *
 * This is distinct from `DonorRecurringActivatedEmail`, which fires only
 * after the FIRST debit has been collected (3–5 days later). Donors expect
 * a confirmation right after they submit their bank details, and SEPA
 * pre-notification rules require they be told the upcoming debit's amount
 * and date before the first collection.
 */
export function DonorMandateRegisteredEmail({
  donorName,
  mosqueName,
  monthlyAmount,
  campaignTitle,
  firstDebitDate,
  mandateReference,
  ibanLast4,
  manageUrl,
}: DonorMandateRegisteredEmailProps) {
  return (
    <DonorEmailLayout
      preview={`Your ${monthlyAmount}/month to ${mosqueName} is set up`}
      heading="Recurring donation set up ✅"
      mosqueName={mosqueName}
    >
      <Text style={donorStyles.text}>Hi {donorName},</Text>

      <Text style={donorStyles.text}>
        Thank you for setting up a recurring donation to{' '}
        <strong>{mosqueName}</strong>. Your SEPA mandate is registered. Below
        is what to expect.
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
        {ibanLast4 ? (
          <Text style={donorStyles.receiptRow}>
            <strong>From IBAN:</strong> ••••{ibanLast4}
          </Text>
        ) : null}
        <Text style={donorStyles.receiptRow}>
          <strong>Mandate reference:</strong> {mandateReference}
        </Text>
      </Section>

      <Hr style={{ borderColor: '#E7E2D6', margin: '24px 0' }} />

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Text style={donorStyles.text}>
          <strong>Manage your donation</strong>
        </Text>
        <Text style={donorStyles.textMuted}>
          Use the link below to change the monthly amount or cancel at any
          time. Anyone with this link can manage the donation, so keep it
          private.
        </Text>
        <Button
          href={manageUrl}
          style={{
            backgroundColor: '#1F1B16',
            color: '#FFFFFF',
            padding: '12px 24px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 600,
            textDecoration: 'none',
            display: 'inline-block',
            marginTop: '8px',
          }}
        >
          Manage donation
        </Button>
        <Text style={{ ...donorStyles.textMuted, fontSize: '12px', wordBreak: 'break-all' }}>
          {manageUrl}
        </Text>
      </Section>

      <Hr style={{ borderColor: '#E7E2D6', margin: '24px 0' }} />

      <Text style={donorStyles.textMuted}>
        After the first debit, future collections happen automatically on the
        same day each month. We&apos;ll send a confirmation once your first
        donation has been collected.
      </Text>

      <Text style={donorStyles.textMuted}>
        Under SEPA rules you can also request a refund from your bank for up
        to eight weeks after any collection, no questions asked.
      </Text>
    </DonorEmailLayout>
  );
}

DonorMandateRegisteredEmail.PreviewProps = {
  donorName: 'Yusuf',
  mosqueName: 'Al-Noor Mosque',
  monthlyAmount: '€10.00',
  campaignTitle: 'General sadaqah',
  firstDebitDate: 'May 2, 2026',
  mandateReference: 'IO-1234-5678-9012',
  ibanLast4: '4300',
  manageUrl: 'https://www.bayaan.app/donate/manage/example-token',
} satisfies DonorMandateRegisteredEmailProps;

export default DonorMandateRegisteredEmail;
