'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Mail, Phone, MapPin, Send, Check, AlertCircle } from 'lucide-react';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export default function Contact() {
  const t = useTranslations('marketing.contact');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === 'sending') return;

    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value.trim(),
      organization: (form.elements.namedItem('organization') as HTMLInputElement).value.trim(),
      email: (form.elements.namedItem('email') as HTMLInputElement).value.trim(),
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value.trim(),
    };

    setStatus('sending');
    setErrorMessage('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }

      setStatus('sent');
      form.reset();
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <section
      id="contact"
      className="mkt-section"
      style={{ background: 'var(--mkt-bg-sunken)' }}
    >
      <div className="mkt-container">
        <div className="mx-auto max-w-2xl text-center">
          <span className="mkt-eyebrow">{t('eyebrow')}</span>
          <h2 className="mkt-h2 mt-3">{t('title')}</h2>
          <p className="mkt-lead mt-4 mx-auto" style={{ marginInline: 'auto' }}>
            {t('lead')}
          </p>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,_2fr)_minmax(0,_3fr)] lg:gap-14">
          {/* Left: brand contact details */}
          <aside className="flex flex-col gap-6">
            <div>
              <h3
                className="font-semibold"
                style={{
                  color: 'var(--mkt-fg)',
                  fontSize: '1.05rem',
                  letterSpacing: '-0.01em',
                }}
              >
                {t('directTitle')}
              </h3>
              <p
                className="mt-2 leading-relaxed"
                style={{ color: 'var(--mkt-fg-muted)', fontSize: '0.92rem' }}
              >
                {t('directBody')}
              </p>
            </div>

            <ul className="flex flex-col gap-4">
              <li className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{
                    background: 'var(--mkt-brand-soft)',
                    color: 'var(--mkt-brand-deep)',
                  }}
                >
                  <Mail size={16} aria-hidden />
                </span>
                <a
                  href={`mailto:${t('email')}`}
                  className="mkt-focus-ring transition-colors"
                  style={{ color: 'var(--mkt-fg)', fontSize: '0.95rem' }}
                >
                  {t('email')}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{
                    background: 'var(--mkt-brand-soft)',
                    color: 'var(--mkt-brand-deep)',
                  }}
                >
                  <Phone size={16} aria-hidden />
                </span>
                <span style={{ color: 'var(--mkt-fg)', fontSize: '0.95rem' }}>
                  {t('phone')}
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{
                    background: 'var(--mkt-brand-soft)',
                    color: 'var(--mkt-brand-deep)',
                  }}
                >
                  <MapPin size={16} aria-hidden />
                </span>
                <span style={{ color: 'var(--mkt-fg)', fontSize: '0.95rem' }}>
                  {t('city')}
                </span>
              </li>
            </ul>

            <p
              className="leading-relaxed"
              style={{ color: 'var(--mkt-fg-subtle)', fontSize: '0.85rem' }}
            >
              {t('responseTime')}
            </p>
          </aside>

          {/* Right: form card */}
          <form
            onSubmit={handleSubmit}
            className="mkt-card flex flex-col gap-5"
            noValidate
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t('fields.name')} required>
                <input
                  type="text"
                  name="name"
                  required
                  autoComplete="name"
                  disabled={status === 'sending'}
                  className="mkt-focus-ring w-full rounded-lg px-3 py-2.5"
                  style={fieldStyle}
                />
              </Field>
              <Field label={t('fields.organization')}>
                <input
                  type="text"
                  name="organization"
                  autoComplete="organization"
                  disabled={status === 'sending'}
                  className="mkt-focus-ring w-full rounded-lg px-3 py-2.5"
                  style={fieldStyle}
                />
              </Field>
            </div>

            <Field label={t('fields.email')} required>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                disabled={status === 'sending'}
                className="mkt-focus-ring w-full rounded-lg px-3 py-2.5"
                style={fieldStyle}
              />
            </Field>

            <Field label={t('fields.message')} required>
              <textarea
                name="message"
                required
                rows={5}
                disabled={status === 'sending'}
                className="mkt-focus-ring w-full rounded-lg px-3 py-2.5"
                style={{ ...fieldStyle, resize: 'vertical', minHeight: 120 }}
              />
            </Field>

            <div className="flex items-center justify-between gap-4">
              <p
                style={{
                  color: 'var(--mkt-fg-subtle)',
                  fontSize: '0.78rem',
                  lineHeight: 1.5,
                }}
              >
                {t('privacyNote')}
              </p>
              <button
                type="submit"
                disabled={status === 'sending'}
                className="mkt-focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[14.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: 'var(--mkt-brand)',
                  color: 'oklch(0.99 0.005 165)',
                  whiteSpace: 'nowrap',
                }}
              >
                <Send size={16} aria-hidden />
                <span>
                  {status === 'sending' ? t('sending') : t('submit')}
                </span>
              </button>
            </div>

            {status === 'sent' && (
              <div
                role="status"
                className="flex items-start gap-2.5 rounded-lg px-3 py-3"
                style={{
                  background: 'oklch(0.95 0.04 165)',
                  border: '1px solid oklch(0.85 0.06 165)',
                  color: 'var(--mkt-brand-deep)',
                  fontSize: '0.9rem',
                }}
              >
                <Check size={16} aria-hidden className="mt-0.5 flex-shrink-0" />
                <span>{t('successMessage')}</span>
              </div>
            )}

            {status === 'error' && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg px-3 py-3"
                style={{
                  background: 'oklch(0.96 0.04 25)',
                  border: '1px solid oklch(0.85 0.08 25)',
                  color: 'oklch(0.45 0.12 25)',
                  fontSize: '0.9rem',
                }}
              >
                <AlertCircle size={16} aria-hidden className="mt-0.5 flex-shrink-0" />
                <span>{errorMessage || t('errorMessage')}</span>
              </div>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}

const fieldStyle: React.CSSProperties = {
  background: 'var(--mkt-bg)',
  border: '1px solid var(--mkt-border)',
  color: 'var(--mkt-fg)',
  fontSize: '0.95rem',
  letterSpacing: '-0.005em',
};

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span
        className="font-medium"
        style={{
          color: 'var(--mkt-fg)',
          fontSize: '0.85rem',
          letterSpacing: '-0.005em',
        }}
      >
        {label}
        {required && (
          <span aria-hidden style={{ color: 'var(--mkt-brand)' }}>
            {' *'}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
