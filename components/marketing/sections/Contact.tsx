'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Mail, Phone, MapPin, Send, Check, AlertCircle } from 'lucide-react';
import {
  SketchButton,
  SketchCard,
  SketchField,
  SketchInput,
  SketchTextarea,
  StickyTag,
} from '@/components/marketing/sketch';

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
    <section id="contact" className="mkt-section">
      <div className="mkt-container">
        <div className="mx-auto max-w-2xl text-center">
          <StickyTag rotate={-2} tone="postit">
            {t('eyebrow')}
          </StickyTag>
          <h2 className="mkt-h2 mt-6">{t('title')}</h2>
          <p className="mkt-lead mt-6 mx-auto" style={{ marginInline: 'auto' }}>
            {t('lead')}
          </p>
        </div>

        <div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,_2fr)_minmax(0,_3fr)] lg:gap-16">
          {/* Left: contact details on a paper card */}
          <SketchCard tone="paper" rotate={-1} radiusVariant="b">
            <h3
              style={{
                fontFamily: 'var(--mkt-font-display)',
                fontSize: '1.4rem',
                fontWeight: 700,
                color: 'var(--mkt-fg)',
              }}
            >
              {t('directTitle')}
            </h3>
            <p
              className="mt-3"
              style={{
                fontFamily: 'var(--mkt-font-body)',
                color: 'var(--mkt-fg-muted)',
                fontSize: '1.02rem',
                lineHeight: 1.55,
              }}
            >
              {t('directBody')}
            </p>

            <ul className="mt-6 flex flex-col gap-4">
              <ContactItem
                icon={<Mail size={18} strokeWidth={2.6} aria-hidden />}
              >
                <a
                  href={`mailto:${t('email')}`}
                  className="mkt-link mkt-focus-ring"
                  style={{
                    fontFamily: 'var(--mkt-font-body)',
                    fontSize: '1.05rem',
                  }}
                >
                  {t('email')}
                </a>
              </ContactItem>
              <ContactItem
                icon={<Phone size={18} strokeWidth={2.6} aria-hidden />}
              >
                <span
                  style={{
                    fontFamily: 'var(--mkt-font-body)',
                    fontSize: '1.05rem',
                    color: 'var(--mkt-fg)',
                  }}
                >
                  {t('phone')}
                </span>
              </ContactItem>
              <ContactItem
                icon={<MapPin size={18} strokeWidth={2.6} aria-hidden />}
              >
                <span
                  style={{
                    fontFamily: 'var(--mkt-font-body)',
                    fontSize: '1.05rem',
                    color: 'var(--mkt-fg)',
                  }}
                >
                  {t('city')}
                </span>
              </ContactItem>
            </ul>

            <p
              className="mt-6"
              style={{
                fontFamily: 'var(--mkt-font-body)',
                color: 'var(--mkt-fg-subtle)',
                fontSize: '0.92rem',
                lineHeight: 1.5,
              }}
            >
              {t('responseTime')}
            </p>
          </SketchCard>

          {/* Right: form */}
          <form
            onSubmit={handleSubmit}
            noValidate
            style={{
              background: 'var(--mkt-bg-elev)',
              border: '2.5px solid var(--mkt-border)',
              borderRadius: 'var(--mkt-wobbly)',
              boxShadow: 'var(--mkt-shadow-card-strong)',
              padding: 'clamp(1.75rem, 3vw, 2.5rem)',
              transform: 'rotate(0.6deg)',
            }}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <SketchField label={t('fields.name')} required>
                <SketchInput
                  type="text"
                  name="name"
                  required
                  autoComplete="name"
                  disabled={status === 'sending'}
                />
              </SketchField>
              <SketchField label={t('fields.organization')}>
                <SketchInput
                  type="text"
                  name="organization"
                  autoComplete="organization"
                  disabled={status === 'sending'}
                />
              </SketchField>
            </div>

            <div className="mt-5">
              <SketchField label={t('fields.email')} required>
                <SketchInput
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  disabled={status === 'sending'}
                />
              </SketchField>
            </div>

            <div className="mt-5">
              <SketchField label={t('fields.message')} required>
                <SketchTextarea
                  name="message"
                  required
                  rows={5}
                  disabled={status === 'sending'}
                />
              </SketchField>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
              <p
                style={{
                  fontFamily: 'var(--mkt-font-body)',
                  color: 'var(--mkt-fg-subtle)',
                  fontSize: '0.85rem',
                  lineHeight: 1.5,
                  maxWidth: '20rem',
                }}
              >
                {t('privacyNote')}
              </p>
              <SketchButton
                type="submit"
                disabled={status === 'sending'}
                size="md"
              >
                <Send size={16} strokeWidth={2.6} aria-hidden />
                <span>
                  {status === 'sending' ? t('sending') : t('submit')}
                </span>
              </SketchButton>
            </div>

            {status === 'sent' && (
              <div
                role="status"
                className="mt-5 flex items-start gap-2.5 px-4 py-3"
                style={{
                  background: 'var(--mkt-postit)',
                  border: '2px solid var(--mkt-border)',
                  borderRadius: 'var(--mkt-wobbly-md)',
                  fontFamily: 'var(--mkt-font-body)',
                  color: 'var(--mkt-fg)',
                  fontSize: '1rem',
                }}
              >
                <Check size={18} strokeWidth={2.6} aria-hidden className="mt-0.5 flex-shrink-0" />
                <span>{t('successMessage')}</span>
              </div>
            )}

            {status === 'error' && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2.5 px-4 py-3"
                style={{
                  background: 'var(--mkt-accent-soft)',
                  border: '2px solid var(--mkt-accent)',
                  borderRadius: 'var(--mkt-wobbly-md)',
                  fontFamily: 'var(--mkt-font-body)',
                  color: 'var(--mkt-accent-deep)',
                  fontSize: '1rem',
                }}
              >
                <AlertCircle
                  size={18}
                  strokeWidth={2.6}
                  aria-hidden
                  className="mt-0.5 flex-shrink-0"
                />
                <span>{errorMessage || t('errorMessage')}</span>
              </div>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}

function ContactItem({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center"
        style={{
          background: 'var(--mkt-postit)',
          color: 'var(--mkt-fg)',
          border: '2px solid var(--mkt-border)',
          borderRadius: 'var(--mkt-wobbly-blob-2)',
          boxShadow: '2px 2px 0 0 var(--mkt-border)',
        }}
      >
        {icon}
      </span>
      {children}
    </li>
  );
}
