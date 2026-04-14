import { Link, Section, Text } from '@react-email/components';
import { EmailLayout, styles } from './_layout';

interface CardExpiringEmailProps {
  userName: string;
  organizationName: string;
  cardBrand: string; // "Visa", "Mastercard", etc.
  last4: string;
  expiryMonth: string; // "04" or "April"
  expiryYear: string; // "2026"
  updatePaymentUrl: string;
}

export function CardExpiringEmail({
  userName,
  organizationName,
  cardBrand,
  last4,
  expiryMonth,
  expiryYear,
  updatePaymentUrl,
}: CardExpiringEmailProps) {
  return (
    <EmailLayout
      preview={`Your ${cardBrand} ending ${last4} expires soon`}
      heading="Your card expires soon 💳"
    >
      <Text style={styles.text}>Hi {userName},</Text>

      <Text style={styles.text}>
        The card on file for <strong>{organizationName}</strong> is about to expire.
        Update it now to avoid a missed payment.
      </Text>

      <Section style={styles.infoBox}>
        <Text style={styles.infoText}>
          <strong>Card:</strong> {cardBrand} ending {last4}
          <br />
          <strong>Expires:</strong> {expiryMonth}/{expiryYear}
        </Text>
      </Section>

      <Link href={updatePaymentUrl} style={styles.button}>
        Update card
      </Link>

      <Text style={styles.textMuted}>
        It only takes a minute. We&apos;ll keep using your current card until then.
      </Text>
    </EmailLayout>
  );
}

CardExpiringEmail.PreviewProps = {
  userName: 'Ahmed',
  organizationName: 'Al-Noor Mosque',
  cardBrand: 'Visa',
  last4: '4242',
  expiryMonth: '04',
  expiryYear: '2026',
  updatePaymentUrl: 'https://bayaan.ai/dashboard/billing',
} satisfies CardExpiringEmailProps;

export default CardExpiringEmail;
