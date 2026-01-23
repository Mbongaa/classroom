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

interface WelcomeEmailProps {
  userName: string;
  organizationName: string;
  planName: string;
  billingPeriodEnd: string;
  dashboardUrl: string;
  billingPortalUrl: string;
}

export function WelcomeEmail({
  userName,
  organizationName,
  planName,
  billingPeriodEnd,
  dashboardUrl,
  billingPortalUrl,
}: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to Bayaan Classroom - Your subscription is active</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Welcome to Bayaan Classroom! 🎉</Heading>

          <Text style={text}>Hi {userName},</Text>

          <Text style={text}>
            Thank you for subscribing to Bayaan Classroom! Your {planName} plan is now active.
          </Text>

          <Section style={infoBox}>
            <Text style={infoTitle}>Subscription Details</Text>
            <Text style={infoText}>
              <strong>Organization:</strong> {organizationName}<br />
              <strong>Plan:</strong> {planName}<br />
              <strong>Next billing date:</strong> {billingPeriodEnd}
            </Text>
          </Section>

          <Text style={text}>
            You can now access your dashboard and start creating classrooms:
          </Text>

          <Link href={dashboardUrl} style={button}>
            Go to Dashboard
          </Link>

          <Hr style={hr} />

          <Text style={text}>
            Manage your subscription anytime:
          </Text>

          <Link href={billingPortalUrl} style={linkText}>
            Billing Portal
          </Link>

          <Text style={footer}>
            If you have any questions, reply to this email or contact support.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// Styles (inline CSS for email compatibility)
const main = { backgroundColor: '#f6f9fc', fontFamily: 'sans-serif' };
const container = { margin: '0 auto', padding: '20px 0', width: '580px' };
const h1 = { color: '#333', fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' };
const text = { color: '#333', fontSize: '16px', lineHeight: '24px', marginBottom: '16px' };
const infoBox = { backgroundColor: '#f0f0f0', borderRadius: '8px', padding: '16px', marginBottom: '16px' };
const infoTitle = { fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#555' };
const infoText = { fontSize: '14px', lineHeight: '20px', color: '#333', margin: 0 };
const button = {
  backgroundColor: '#0070f3',
  borderRadius: '5px',
  color: '#fff',
  display: 'inline-block',
  fontSize: '16px',
  padding: '12px 24px',
  textDecoration: 'none',
};
const linkText = { color: '#0070f3', fontSize: '14px', textDecoration: 'underline' };
const hr = { borderColor: '#e6e6e6', margin: '20px 0' };
const footer = { color: '#8898aa', fontSize: '12px', lineHeight: '16px' };
