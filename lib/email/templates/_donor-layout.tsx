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

interface DonorEmailLayoutProps {
  preview: string;
  heading: string;
  /** The mosque's display name — shown as the email's brand header. */
  mosqueName: string;
  children: ReactNode;
}

/**
 * Cobranded donor-facing layout.
 *
 * Light theme (donors expect receipt-style emails to be bright). The mosque
 * is the primary brand — its name sits in the header. Bayaan sits as a small
 * "Powered by" in the footer. Sent from `donations@bayaan.ai` with the
 * mosque name in the From display (`"Al-Noor Mosque via Bayaan <...>"`).
 */
export function DonorEmailLayout({
  preview,
  heading,
  mosqueName,
  children,
}: DonorEmailLayoutProps) {
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
            <Text style={brandText}>{mosqueName}</Text>
          </Section>

          <Container style={card}>
            <Heading style={h1}>{heading}</Heading>
            {children}
          </Container>

          <Section style={footerSection}>
            <Text style={footerText}>
              Questions about your donation? Just reply to this email — it goes
              straight to {mosqueName}.
            </Text>
            <Text style={footerSmall}>
              Powered by{' '}
              <Link href="https://bayaan.ai" style={footerLink}>
                Bayaan
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Donor-facing style tokens — light receipt aesthetic.
export const donorStyles = {
  text: {
    color: '#1A1A1A',
    fontSize: '15px',
    lineHeight: '24px',
    margin: '0 0 16px',
    fontFamily: '"Poppins", Helvetica, Arial, sans-serif',
    fontWeight: 400,
  },
  textMuted: {
    color: '#6B6B6B',
    fontSize: '13px',
    lineHeight: '20px',
    margin: '0 0 12px',
    fontFamily: '"Poppins", Helvetica, Arial, sans-serif',
    fontWeight: 400,
  },
  button: {
    backgroundColor: '#1A1A1A',
    borderRadius: '10px',
    color: '#FFFFFF',
    display: 'inline-block',
    fontSize: '15px',
    fontWeight: 600,
    padding: '12px 28px',
    textDecoration: 'none',
    margin: '8px 0 24px',
    fontFamily: '"Poppins", Helvetica, Arial, sans-serif',
  },
  linkText: {
    color: '#6B6B6B',
    fontSize: '12px',
    lineHeight: '18px',
    textDecoration: 'underline',
    wordBreak: 'break-all' as const,
    fontFamily: '"Poppins", Helvetica, Arial, sans-serif',
  },
  receiptBox: {
    backgroundColor: '#F7F5F0',
    border: '1px solid #E7E2D6',
    borderRadius: '10px',
    padding: '16px 18px',
    margin: '0 0 20px',
  },
  receiptRow: {
    color: '#1A1A1A',
    fontSize: '14px',
    lineHeight: '22px',
    margin: 0,
    fontFamily: '"Poppins", Helvetica, Arial, sans-serif',
  },
  amountLarge: {
    color: '#1A1A1A',
    fontSize: '32px',
    fontWeight: 700,
    lineHeight: '40px',
    margin: '4px 0 0',
    letterSpacing: '-0.02em',
    fontFamily: '"Poppins", Helvetica, Arial, sans-serif',
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    border: '1px solid #FCD34D',
    borderRadius: '10px',
    padding: '12px 16px',
    margin: '8px 0 16px',
  },
  warningText: {
    color: '#92400E',
    fontSize: '13px',
    lineHeight: '20px',
    margin: 0,
    fontFamily: '"Poppins", Helvetica, Arial, sans-serif',
  },
};

// --- Layout chrome --------------------------------------------------------

const main = {
  backgroundColor: '#FAF8F3',
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
  color: '#1A1A1A',
  fontSize: '20px',
  fontWeight: 700,
  letterSpacing: '-0.02em',
  margin: 0,
  fontFamily: '"Poppins", Helvetica, Arial, sans-serif',
};

const card = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #E7E2D6',
  borderRadius: '14px',
  padding: '32px',
};

const h1 = {
  color: '#1A1A1A',
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
  color: '#6B6B6B',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '0 0 6px',
  fontFamily: '"Poppins", Helvetica, Arial, sans-serif',
};

const footerSmall = {
  color: '#9A9A9A',
  fontSize: '11px',
  lineHeight: '16px',
  margin: 0,
  fontFamily: '"Poppins", Helvetica, Arial, sans-serif',
};

const footerLink = {
  color: '#6B6B6B',
  textDecoration: 'underline',
};

export { Hr };
