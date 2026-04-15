import { Link, Section, Text } from '@react-email/components';
import { defaultLocale, type Locale } from '@/i18n/config';
import { getEmailTranslator } from '../i18n';
import { EmailLayout, styles } from './_layout';

interface MagicLinkEmailProps {
  userName?: string;
  magicLinkUrl: string;
  locale?: Locale;
}

export function MagicLinkEmail({
  userName,
  magicLinkUrl,
  locale = defaultLocale,
}: MagicLinkEmailProps) {
  const t = getEmailTranslator(locale, 'emails.magicLink');
  const tCommon = getEmailTranslator(locale, 'emails.common');
  const greeting = userName ? tCommon('greetingNamed', { name: userName }) : tCommon('greetingAnon');

  return (
    <EmailLayout preview={t('preview')} heading={t('heading')} locale={locale}>
      <Text style={styles.text}>{greeting}</Text>

      <Text style={styles.text}>{t('body')}</Text>

      <Link href={magicLinkUrl} style={styles.button}>
        {t('cta')}
      </Link>

      <Text style={styles.textMuted}>{tCommon('orCopyUrl')}</Text>
      <Link href={magicLinkUrl} style={styles.linkText}>
        {magicLinkUrl}
      </Link>

      <Section style={styles.warningBox}>
        <Text style={styles.warningText}>{t('disclaimer')}</Text>
      </Section>
    </EmailLayout>
  );
}

MagicLinkEmail.PreviewProps = {
  userName: 'Ahmed',
  magicLinkUrl: 'https://bayaan.app/api/auth/confirm?token_hash=preview&type=magiclink&next=/dashboard',
  locale: 'en',
} satisfies MagicLinkEmailProps;

export default MagicLinkEmail;
