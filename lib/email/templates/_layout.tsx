import {
  Body,
  Container,
  Font,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { ReactNode } from 'react';

interface EmailLayoutProps {
  preview: string;
  heading: string;
  children: ReactNode;
}

/**
 * Shared brand wrapper for all Bayaan transactional emails.
 *
 * Mirrors the bayaan.ai dark-mode website: #1A1A1A page surface,
 * #2A2A2A card surface, Poppins typography, and a white primary CTA
 * to match the dashboard's `--primary` token.
 */
export function EmailLayout({ preview, heading, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head>
        <Font
          fontFamily="Poppins"
          fallbackFontFamily={['Helvetica', 'Arial', 'sans-serif']}
          webFont={{
            url: 'https://fonts.gstatic.com/s/poppins/v20/pxiEyp8kv8JHgFVrJJfecnFHGPc.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <Font
          fontFamily="Poppins"
          fallbackFontFamily={['Helvetica', 'Arial', 'sans-serif']}
          webFont={{
            url: 'https://fonts.gstatic.com/s/poppins/v20/pxiByp8kv8JHgFVrLGT9Z1xlFQ.woff2',
            format: 'woff2',
          }}
          fontWeight={600}
          fontStyle="normal"
        />
        <Font
          fontFamily="Poppins"
          fallbackFontFamily={['Helvetica', 'Arial', 'sans-serif']}
          webFont={{
            url: 'https://fonts.gstatic.com/s/poppins/v20/pxiByp8kv8JHgFVrLCz7Z1xlFQ.woff2',
            format: 'woff2',
          }}
          fontWeight={700}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={outer}>
          <Section style={brandHeader}>
            <Text style={brandText}>bayaan.ai</Text>
          </Section>

          <Container style={card}>
            <Heading style={h1}>{heading}</Heading>
            {children}
          </Container>

          <Section style={footerSection}>
            <Text style={footerText}>
              Need help? Just reply to this email.
            </Text>
            <Text style={footerSmall}>
              <Link href="https://bayaan.ai" style={footerLink}>
                bayaan.ai
              </Link>
              {' · Real-time translation for modern classrooms'}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Shared style tokens — mirror bayaan.ai dark mode (`globals.css` :root.dark).
// Inline styles only, since email clients don't support CSS variables.
export const styles = {
  text: {
    color: '#FAFAFA',
    fontSize: '15px',
    lineHeight: '24px',
    margin: '0 0 16px',
    fontFamily: '"Poppins", Helvetica, Arial, sans-serif',
    fontWeight: 400,
  },
  textMuted: {
    color: '#B3B3B3',
    fontSize: '13px',
    lineHeight: '20px',
    margin: '0 0 12px',
    fontFamily: '"Poppins", Helvetica, Arial, sans-serif',
    fontWeight: 400,
  },
  button: {
    backgroundColor: '#FAFAFA',
    borderRadius: '10px',
    color: '#1A1A1A',
    display: 'inline-block',
    fontSize: '15px',
    fontWeight: 600,
    padding: '12px 28px',
    textDecoration: 'none',
    margin: '8px 0 24px',
    fontFamily: '"Poppins", Helvetica, Arial, sans-serif',
  },
  linkText: {
    color: '#B3B3B3',
    fontSize: '12px',
    lineHeight: '18px',
    textDecoration: 'underline',
    wordBreak: 'break-all' as const,
    fontFamily: '"Poppins", Helvetica, Arial, sans-serif',
  },
  infoBox: {
    backgroundColor: '#202020',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    padding: '14px 16px',
    margin: '0 0 20px',
  },
  infoText: {
    color: '#FAFAFA',
    fontSize: '13px',
    lineHeight: '20px',
    margin: 0,
    fontFamily: '"Poppins", Helvetica, Arial, sans-serif',
  },
  warningBox: {
    backgroundColor: 'rgba(251,191,36,0.08)',
    border: '1px solid rgba(251,191,36,0.25)',
    borderRadius: '10px',
    padding: '12px 16px',
    margin: '8px 0 16px',
  },
  warningText: {
    color: '#fbbf24',
    fontSize: '13px',
    lineHeight: '20px',
    margin: 0,
    fontFamily: '"Poppins", Helvetica, Arial, sans-serif',
  },
};

// --- Layout chrome --------------------------------------------------------

const main = {
  backgroundColor: '#1A1A1A',
  margin: 0,
  padding: '32px 16px',
  fontFamily: '"Poppins", Helvetica, Arial, sans-serif',
};

const outer = {
  margin: '0 auto',
  maxWidth: '560px',
  width: '100%',
};

const brandHeader = {
  padding: '0 4px 20px',
};

const brandText = {
  color: '#FAFAFA',
  fontSize: '20px',
  fontWeight: 700,
  letterSpacing: '-0.03em',
  margin: 0,
  fontFamily: '"Poppins", Helvetica, Arial, sans-serif',
};

const card = {
  backgroundColor: '#2A2A2A',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '14px',
  padding: '32px',
};

const h1 = {
  color: '#FAFAFA',
  fontSize: '22px',
  fontWeight: 700,
  letterSpacing: '-0.01em',
  margin: '0 0 20px',
  fontFamily: '"Poppins", Helvetica, Arial, sans-serif',
};

const footerSection = {
  padding: '24px 4px 0',
};

const footerText = {
  color: '#B3B3B3',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '0 0 6px',
  fontFamily: '"Poppins", Helvetica, Arial, sans-serif',
};

const footerSmall = {
  color: '#7A7A7A',
  fontSize: '11px',
  lineHeight: '16px',
  margin: 0,
  fontFamily: '"Poppins", Helvetica, Arial, sans-serif',
};

const footerLink = {
  color: '#B3B3B3',
  textDecoration: 'underline',
};

// Re-export Hr for consumers that want a visual divider inside the card.
export { Hr };
