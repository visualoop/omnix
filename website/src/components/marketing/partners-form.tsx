'use client';

import * as React from 'react';
import { Send } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const INTERESTS = [
  { value: 'reseller',    label: 'Reseller — sell licences in my region' },
  { value: 'integration', label: 'Integration — embed Omnix into a workflow' },
  { value: 'oem',         label: 'OEM — bundle with hardware' },
  { value: 'referral',    label: 'Referral — introduce customers' },
  { value: 'other',       label: 'Something else' },
] as const;

type InterestValue = (typeof INTERESTS)[number]['value'];

export function PartnersForm() {
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Honeypot: real users never fill this hidden field.
  const [website, setWebsite] = React.useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      fullName: String(formData.get('fullName') ?? '').trim(),
      organization: String(formData.get('organization') ?? '').trim(),
      email: String(formData.get('email') ?? '').trim(),
      phone: String(formData.get('phone') ?? '').trim(),
      country: String(formData.get('country') ?? '').trim(),
      interest: String(formData.get('interest') ?? 'reseller') as InterestValue,
      message: String(formData.get('message') ?? '').trim(),
      website,
    };

    try {
      const res = await fetch('/api/partnerships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data?.error === 'too_many_requests'
            ? 'You\'ve submitted a few times in a row. Try again in a minute.'
            : data?.error === 'invalid_payload'
              ? 'A field is missing or too short. Please review and try again.'
              : 'Could not send. Try emailing partners@omnix.co.ke directly.',
        );
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Could not send. Try emailing partners@omnix.co.ke directly.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-[var(--color-accent)] bg-[var(--color-accent-soft)] p-8">
        <div className="font-display text-[22px] font-medium text-[var(--color-fg)]">
          Got it. We\'ll be in touch.
        </div>
        <p className="mt-2 text-[15px] leading-[1.55] text-[var(--color-fg-muted)]">
          You\'ll get a confirmation in your inbox shortly. The Omnix team will
          follow up within two business days, often the same day if your enquiry
          is clear.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4">
      <Field name="fullName" label="Full name" required placeholder="Esther Wairimu" />
      <Field name="organization" label="Organisation / company" required placeholder="Wairimu Distributors Ltd" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field name="email" type="email" label="Email" required placeholder="you@company.co.ke" />
        <Field name="phone" type="tel" label="Phone / WhatsApp" required placeholder="+254 7XX XXX XXX" />
      </div>
      <Field name="country" label="Country or region" required placeholder="Kenya — Central + Eastern" />

      <div className="flex flex-col gap-2">
        <label
          htmlFor="interest"
          className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]"
        >
          What kind of partnership? <span className="text-[var(--color-accent)]">*</span>
        </label>
        <Select name="interest" required defaultValue="reseller">
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {INTERESTS.map((i) => (
              <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="message"
          className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]"
        >
          Tell us about it <span className="text-[var(--color-accent)]">*</span>
        </label>
        <Textarea
          id="message"
          name="message"
          required
          rows={6}
          minLength={20}
          placeholder="Industries you serve, monthly deployment estimate, distribution channels, anything unique about your set-up."
          className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-3 text-[14px] text-[var(--color-fg)] outline-none transition-colors placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)]"
        />
      </div>

      {/* Honeypot — hidden from real users, bots will fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
        <label>
          Leave this empty
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      {error ? (
        <div className="rounded-md border border-[var(--color-negative)] bg-[var(--color-negative)]/10 px-3 py-2 text-[13px] text-[var(--color-fg)]">
          {error}
        </div>
      ) : null}

      <Button type="submit" size="lg" disabled={submitting} className="mt-2 w-full sm:w-auto">
        {submitting ? 'Sending…' : 'Send enquiry'}
        <Send className="size-4" />
      </Button>

      <p className="text-[11px] leading-[1.5] text-[var(--color-fg-subtle)]">
        Submitting this form is not a partnership offer; it starts the
        conversation. Read the{' '}
        <a href="/terms" className="underline-offset-4 hover:underline">terms</a>
        {' '}and{' '}
        <a href="/privacy" className="underline-offset-4 hover:underline">privacy policy</a>.
      </p>
    </form>
  );
}

function Field({
  name, type = 'text', label, required, placeholder,
}: {
  name: string;
  type?: string;
  label: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={name}
        className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]"
      >
        {label}{required ? <span className="text-[var(--color-accent)]"> *</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2.5 text-[14px] text-[var(--color-fg)] outline-none transition-colors placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)]"
      />
    </div>
  );
}
