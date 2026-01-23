import { Resend } from 'resend';
import { ReactElement } from 'react';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  react: ReactElement;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

export async function sendEmail(options: SendEmailOptions) {
  const { to, subject, react, replyTo, tags } = options;

  try {
    const { data, error } = await resend.emails.send({
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      react,
      replyTo,
      tags,
    });

    if (error) {
      console.error('[Email Service] Send failed:', error);
      throw new Error(`Email send failed: ${error.message}`);
    }

    console.log('[Email Service] Email sent successfully:', data?.id);
    return { success: true, id: data?.id };
  } catch (error) {
    console.error('[Email Service] Unexpected error:', error);
    return { success: false, error };
  }
}

// Batch email sending for classroom summaries (future use)
export async function sendBatchEmails(
  recipients: string[],
  subject: string,
  react: ReactElement
) {
  const results = await Promise.allSettled(
    recipients.map((email) =>
      sendEmail({ to: email, subject, react })
    )
  );

  const successful = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  console.log(`[Email Service] Batch send: ${successful} sent, ${failed} failed`);

  return { successful, failed, results };
}
