import { Section, Text } from '@react-email/components';
import { EmailLayout, styles } from './_layout';

interface ContactSubmissionEmailProps {
  name: string;
  email: string;
  organization: string | null;
  message: string;
  /** ISO date — pre-formatted on the server. */
  submittedAt: string;
}

/**
 * Inbox notification when someone submits the marketing landing contact form.
 * Sent to the team inbox; `replyTo` on the outer call is set to the visitor
 * so a single reply hits their inbox directly.
 */
export function ContactSubmissionEmail({
  name,
  email,
  organization,
  message,
  submittedAt,
}: ContactSubmissionEmailProps) {
  return (
    <EmailLayout
      preview={`New contact form submission from ${name}`}
      heading="New contact form submission"
    >
      <Text style={styles.text}>
        Someone reached out through the bayaan.ai landing page contact form.
        Hit reply to respond to them directly.
      </Text>

      <Section style={styles.infoBox}>
        <Text style={styles.infoText}>
          <strong>From:</strong> {name}
          <br />
          <strong>Email:</strong> {email}
          {organization && (
            <>
              <br />
              <strong>Organization:</strong> {organization}
            </>
          )}
          <br />
          <strong>Submitted:</strong> {submittedAt}
        </Text>
      </Section>

      <Text style={{ ...styles.text, fontWeight: 600 }}>Message</Text>
      <Section
        style={{
          ...styles.infoBox,
          whiteSpace: 'pre-wrap' as const,
        }}
      >
        <Text style={{ ...styles.infoText, whiteSpace: 'pre-wrap' as const }}>
          {message}
        </Text>
      </Section>

      <Text style={styles.textMuted}>
        Saved to <code>contact_submissions</code> in Supabase.
      </Text>
    </EmailLayout>
  );
}

ContactSubmissionEmail.PreviewProps = {
  name: 'Yusuf Ahmed',
  email: 'yusuf@example.org',
  organization: 'Masjid Al-Noor',
  message:
    'As-salaamu alaykum, we run weekly khutbahs for ~120 attendees and would love to add live translation. What does setup involve?',
  submittedAt: '2 May 2026 · 14:32 (Europe/Amsterdam)',
} satisfies ContactSubmissionEmailProps;

export default ContactSubmissionEmail;
