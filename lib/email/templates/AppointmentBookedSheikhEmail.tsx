import { Link, Section, Text } from '@react-email/components';
import { EmailLayout, styles } from './_layout';

interface AppointmentBookedSheikhEmailProps {
  sheikhName: string;
  organizationName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  scheduledDate: string; // pre-formatted, e.g. "Monday, April 20 · 10:00 (Europe/Amsterdam)"
  durationMinutes: number;
  amount: string; // pre-formatted
  location: string | null;
  notes: string | null;
  dashboardUrl: string;
}

export function AppointmentBookedSheikhEmail({
  sheikhName,
  organizationName,
  customerName,
  customerEmail,
  customerPhone,
  scheduledDate,
  durationMinutes,
  amount,
  location,
  notes,
  dashboardUrl,
}: AppointmentBookedSheikhEmailProps) {
  return (
    <EmailLayout
      preview={`${customerName} booked a session for ${scheduledDate}`}
      heading="New appointment booked 🗓️"
    >
      <Text style={styles.text}>As-salaamu alaykum {sheikhName},</Text>

      <Text style={styles.text}>
        A new 1-on-1 session has been booked through <strong>{organizationName}</strong>.
        Payment has been received.
      </Text>

      <Section style={styles.infoBox}>
        <Text style={styles.infoText}>
          <strong>When:</strong> {scheduledDate}
          <br />
          <strong>Duration:</strong> {durationMinutes} min
          <br />
          <strong>Amount paid:</strong> {amount}
          <br />
          {location && (
            <>
              <strong>Location:</strong> {location}
              <br />
            </>
          )}
          <strong>Name:</strong> {customerName}
          <br />
          <strong>Email:</strong> {customerEmail}
          {customerPhone && (
            <>
              <br />
              <strong>Phone:</strong> {customerPhone}
            </>
          )}
          {notes && (
            <>
              <br />
              <strong>Notes:</strong> {notes}
            </>
          )}
        </Text>
      </Section>

      <Link href={dashboardUrl} style={styles.button}>
        View in dashboard
      </Link>

      <Text style={styles.textMuted}>
        Please reach out to the customer if you need to confirm location details or
        reschedule.
      </Text>
    </EmailLayout>
  );
}

AppointmentBookedSheikhEmail.PreviewProps = {
  sheikhName: 'Sheikh Ahmed',
  organizationName: 'Al-Noor Mosque',
  customerName: 'Fatima B.',
  customerEmail: 'fatima@example.com',
  customerPhone: '+31 6 12 34 56 78',
  scheduledDate: 'Monday, April 20 · 10:00 (Europe/Amsterdam)',
  durationMinutes: 30,
  amount: '€25.00',
  location: 'Al-Noor Mosque, Amsterdam',
  notes: 'Question about Tajweed rules.',
  dashboardUrl: 'https://bayaan.ai/mosque-admin/al-noor/appointments',
} satisfies AppointmentBookedSheikhEmailProps;

export default AppointmentBookedSheikhEmail;
