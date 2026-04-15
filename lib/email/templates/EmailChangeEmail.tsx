import { Link, Section, Text } from '@react-email/components';
import { defaultLocale, type Locale } from '@/i18n/config';
import { getEmailTranslator } from '../i18n';
import { EmailLayout, styles } from './_layout';

interface EmailChangeEmailProps {
  userName?: string;
  newEmail: string;
  oldEmail: string;
  confirmationUrl: string;
  /**
   * Which side of the change this email is being sent to:
   * - 'new': sent to the new email address (confirms ownership)
   * - 'current': sent to the old email address (security notice)
   */
  recipient: 'new' | 'current';
  locale?: Locale;
}

export function EmailChangeEmail({
  userName,
  newEmail,
  oldEmail,
  confirmationUrl,
  recipient,
  locale = defaultLocale,
}: EmailChangeEmailProps) {
  const t = getEmailTranslator(locale, 'emails.emailChange');
  const tCommon = getEmailTranslator(locale, 'emails.common');
  const isNewAddress = recipient === 'new';
  const greeting = userName ? tCommon('greetingNamed', { name: userName }) : tCommon('greetingAnon');

  return (
    <EmailLayout
      preview={isNewAddress ? t('previewNew') : t('previewCurrent')}
      heading={isNewAddress ? t('headingNew') : t('headingCurrent')}
      locale={locale}
    >
      <Text style={styles.text}>{greeting}</Text>

      <Text style={styles.text}>{isNewAddress ? t('bodyNew') : t('bodyCurrent')}</Text>

      <Section style={styles.infoBox}>
        <Text style={styles.infoText}>
          <strong>{t('fromLabel')}</strong> {oldEmail}
          <br />
          <strong>{t('toLabel')}</strong> {newEmail}
        </Text>
      </Section>

      {isNewAddress && (
        <>
          <Link href={confirmationUrl} style={styles.button}>
            {t('cta')}
          </Link>

          <Text style={styles.textMuted}>{tCommon('orCopyUrl')}</Text>
          <Link href={confirmationUrl} style={styles.linkText}>
            {confirmationUrl}
          </Link>
        </>
      )}

      <Section style={styles.warningBox}>
        <Text style={styles.warningText}>
          {isNewAddress ? t('warningNew') : t('warningCurrent')}
        </Text>
      </Section>
    </EmailLayout>
  );
}

EmailChangeEmail.PreviewProps = {
  userName: 'Ahmed',
  oldEmail: 'ahmed@old-example.com',
  newEmail: 'ahmed@new-example.com',
  confirmationUrl: 'https://bayaan.app/api/auth/confirm?token_hash=preview&type=email_change&next=/dashboard',
  recipient: 'new',
  locale: 'en',
} satisfies EmailChangeEmailProps;

export default EmailChangeEmail;
