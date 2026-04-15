import { Link, Text } from '@react-email/components';
import { defaultLocale, type Locale } from '@/i18n/config';
import { getEmailTranslator } from '../i18n';
import { EmailLayout, styles } from './_layout';

interface ConfirmSignupEmailProps {
  userName?: string;
  confirmationUrl: string;
  locale?: Locale;
}

export function ConfirmSignupEmail({
  userName,
  confirmationUrl,
  locale = defaultLocale,
}: ConfirmSignupEmailProps) {
  const t = getEmailTranslator(locale, 'emails.confirmSignup');
  const tCommon = getEmailTranslator(locale, 'emails.common');
  const greeting = userName ? tCommon('greetingNamed', { name: userName }) : tCommon('greetingAnon');

  return (
    <EmailLayout preview={t('preview')} heading={t('heading')} locale={locale}>
      <Text style={styles.text}>{greeting}</Text>

      <Text style={styles.text}>{t('body')}</Text>

      <Link href={confirmationUrl} style={styles.button}>
        {t('cta')}
      </Link>

      <Text style={styles.textMuted}>{tCommon('orCopyUrl')}</Text>
      <Link href={confirmationUrl} style={styles.linkText}>
        {confirmationUrl}
      </Link>

      <div style={{ marginTop: '16px' }}>
        <Text style={styles.textMuted}>{t('disclaimer')}</Text>
      </div>
    </EmailLayout>
  );
}

ConfirmSignupEmail.PreviewProps = {
  userName: 'Ahmed',
  confirmationUrl: 'https://bayaan.app/api/auth/confirm?token_hash=preview&type=signup&next=/dashboard',
  locale: 'en',
} satisfies ConfirmSignupEmailProps;

export default ConfirmSignupEmail;
