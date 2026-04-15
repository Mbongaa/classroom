import { Section, Text } from '@react-email/components';
import { DonorEmailLayout, donorStyles } from './_donor-layout';

interface AppointmentBookedCustomerEmailProps {
  customerName: string;
  organizationName: string;
  sheikhName: string;
  scheduledDate: string; // pre-formatted e.g. "Monday, April 20 · 10:00 (Europe/Amsterdam)"
  durationMinutes: number;
  amount: string;
  location: string | null;
  orderReference: string;
}

export function AppointmentBookedCustomerEmail({
  customerName,
  organizationName,
  sheikhName,
  scheduledDate,
  durationMinutes,
  amount,
  location,
  orderReference,
}: AppointmentBookedCustomerEmailProps) {
  return (
    <DonorEmailLayout
      preview={`Your appointment with ${sheikhName} on ${scheduledDate}`}
      heading="Your appointment is confirmed ✅"
      mosqueName={organizationName}
    >
      <Text style={donorStyles.text}>As-salaamu alaykum {customerName},</Text>

      <Text style={donorStyles.text}>
        Thank you for booking a session with <strong>{sheikhName}</strong> through{' '}
        <strong>{organizationName}</strong>. Your payment has been received and the sheikh
        has been notified.
      </Text>

      <Section style={donorStyles.receiptBox}>
        <Text style={donorStyles.receiptRow}>
          <strong>When:</strong> {scheduledDate}
          <br />
          <strong>With:</strong> {sheikhName}
          <br />
          <strong>Duration:</strong> {durationMinutes} min
          <br />
          <strong>Paid:</strong> {amount}
          {location && (
            <>
              <br />
              <strong>Location:</strong> {location}
            </>
          )}
          <br />
          <strong>Reference:</strong> {orderReference}
        </Text>
      </Section>

      <Text style={donorStyles.textMuted}>
        If you need to reschedule or have any questions, reply to this email and we&apos;ll
        forward it to the team at {organizationName}.
      </Text>
    </DonorEmailLayout>
  );
}

AppointmentBookedCustomerEmail.PreviewProps = {
  customerName: 'Fatima B.',
  organizationName: 'Al-Noor Mosque',
  sheikhName: 'Sheikh Ahmed',
  scheduledDate: 'Monday, April 20 · 10:00 (Europe/Amsterdam)',
  durationMinutes: 30,
  amount: '€25.00',
  location: 'Al-Noor Mosque, Amsterdam',
  orderReference: '52028325014X23cb',
} satisfies AppointmentBookedCustomerEmailProps;

export default AppointmentBookedCustomerEmail;
