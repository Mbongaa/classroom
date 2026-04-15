import { Link, Section, Text } from '@react-email/components';
import { defaultLocale, type Locale } from '@/i18n/config';
import { getEmailTranslator } from '../i18n';
import { EmailLayout, styles } from './_layout';

interface PasswordResetEmailProps {
  userName?: string;
  resetUrl: string;
  locale?: Locale;
}

export function PasswordResetEmail({
  userName,
  resetUrl,
  locale = defaultLocale,
}: PasswordResetEmailProps) {
  const t = getEmailTranslator(locale, 'emails.passwordReset');
  const tCommon = getEmailTranslator(locale, 'emails.common');
  const greeting = userName ? tCommon('greetingNamed', { name: userName }) : tCommon('greetingAnon');

  return (
    <EmailLayout preview={t('preview')} heading={t('heading')} locale={locale}>
      <Text style={styles.text}>{greeting}</Text>

      <Text style={styles.text}>{t('body')}</Text>

      <Link href={resetUrl} style={styles.button}>
        {t('cta')}
      </Link>

      <Text style={styles.textMuted}>{tCommon('orCopyUrl')}</Text>
      <Link href={resetUrl} style={styles.linkText}>
        {resetUrl}
      </Link>

      <Section style={styles.warningBox}>
        <Text style={styles.warningText}>{t('disclaimer')}</Text>
      </Section>
    </EmailLayout>
  );
}

PasswordResetEmail.PreviewProps = {
  userName: 'Ahmed',
  resetUrl: 'https://bayaan.app/api/auth/confirm?token_hash=preview&type=recovery&next=/reset-password',
  locale: 'en',
} satisfies PasswordResetEmailProps;

export default PasswordResetEmail;
