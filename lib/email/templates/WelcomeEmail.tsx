import { Link, Section, Text } from '@react-email/components';
import { defaultLocale, type Locale } from '@/i18n/config';
import { getEmailTranslator } from '../i18n';
import { EmailLayout, Hr, styles } from './_layout';

interface WelcomeEmailProps {
  userName: string;
  organizationName: string;
  planName: string;
  billingPeriodEnd: string;
  dashboardUrl: string;
  billingPortalUrl: string;
  locale?: Locale;
}

export function WelcomeEmail({
  userName,
  organizationName,
  planName,
  billingPeriodEnd,
  dashboardUrl,
  billingPortalUrl,
  locale = defaultLocale,
}: WelcomeEmailProps) {
  const t = getEmailTranslator(locale, 'emails.welcome');

  return (
    <EmailLayout preview={t('preview')} heading={t('heading')} locale={locale}>
      <Text style={styles.text}>{t('greeting', { name: userName })}</Text>

      <Text style={styles.text}>{t('body', { plan: planName })}</Text>

      <Section style={styles.infoBox}>
        <Text style={styles.infoText}>
          <strong>{t('organizationLabel')}</strong> {organizationName}
          <br />
          <strong>{t('planLabel')}</strong> {planName}
          <br />
          <strong>{t('nextBillingLabel')}</strong> {billingPeriodEnd}
        </Text>
      </Section>

      <Link href={dashboardUrl} style={styles.button}>
        {t('cta')}
      </Link>

      <Hr style={{ borderColor: 'rgba(255,255,255,0.08)', margin: '24px 0' }} />

      <Text style={styles.textMuted}>{t('manageLabel')}</Text>
      <Link href={billingPortalUrl} style={styles.linkText}>
        {t('billingPortal')}
      </Link>
    </EmailLayout>
  );
}

WelcomeEmail.PreviewProps = {
  userName: 'Ahmed',
  organizationName: 'Al-Noor Mosque',
  planName: 'Pro',
  billingPeriodEnd: 'May 14, 2026',
  dashboardUrl: 'https://bayaan.ai/dashboard',
  billingPortalUrl: 'https://bayaan.ai/dashboard/billing',
  locale: 'en',
} satisfies WelcomeEmailProps;

export default WelcomeEmail;
