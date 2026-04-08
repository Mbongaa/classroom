import {
  Body,
  Container,
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
 * Wraps content in the standard header/footer so individual templates
 * only describe what's unique about their message.
 */
export function EmailLayout({ preview, heading, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandHeader}>
            <Text style={brandText}>Bayaan Classroom</Text>
          </Section>

          <Heading style={h1}>{heading}</Heading>

          {children}

          <Hr style={hr} />

          <Text style={footer}>
            If you have any questions, reply to this email or contact support.
          </Text>
          <Text style={footerSmall}>
            Bayaan Classroom &middot;{' '}
            <Link href="https://bayaan.app" style={footerLink}>
              bayaan.app
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// Shared style tokens — kept inline for email-client compatibility.
// If you change brand colors, change them here.
export const styles = {
  text: {
    color: '#333',
    fontSize: '16px',
    lineHeight: '24px',
    marginBottom: '16px',
  },
  textMuted: {
    color: '#555',
    fontSize: '14px',
    lineHeight: '22px',
    marginBottom: '16px',
  },
  button: {
    backgroundColor: '#0070f3',
    borderRadius: '5px',
    color: '#fff',
    display: 'inline-block',
    fontSize: '16px',
    fontWeight: 600,
    padding: '12px 24px',
    textDecoration: 'none',
    marginTop: '8px',
    marginBottom: '8px',
  },
  linkText: {
    color: '#0070f3',
    fontSize: '14px',
    textDecoration: 'underline',
    wordBreak: 'break-all' as const,
  },
  infoBox: {
    backgroundColor: '#f0f0f0',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
  },
  infoText: {
    fontSize: '14px',
    lineHeight: '20px',
    color: '#333',
    margin: 0,
  },
  warningBox: {
    backgroundColor: '#fff8e1',
    border: '1px solid #ffe082',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '16px',
  },
  warningText: {
    fontSize: '14px',
    lineHeight: '20px',
    color: '#7c5e00',
    margin: 0,
  },
};

const main = { backgroundColor: '#f6f9fc', fontFamily: 'sans-serif' };
const container = { margin: '0 auto', padding: '20px 0', width: '580px' };
const brandHeader = { paddingBottom: '12px', borderBottom: '2px solid #0070f3', marginBottom: '24px' };
const brandText = { color: '#0070f3', fontSize: '18px', fontWeight: 'bold', margin: 0 };
const h1 = { color: '#333', fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' };
const hr = { borderColor: '#e6e6e6', margin: '20px 0' };
const footer = { color: '#8898aa', fontSize: '12px', lineHeight: '16px', marginBottom: '4px' };
const footerSmall = { color: '#8898aa', fontSize: '11px', lineHeight: '16px', margin: 0 };
const footerLink = { color: '#8898aa', textDecoration: 'underline' };
