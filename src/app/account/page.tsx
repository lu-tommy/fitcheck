'use client';

import { CloudOff, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { Field, Input } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { pluralize } from '@/lib/format';
import { firebaseReady, missingFirebaseConfig } from '@/sync/firebase';
import { useAuth } from '@/store/auth';
import { useCloset } from '@/store/closet';
import { toast } from '@/store/toast';

type Mode = 'sign-in' | 'register';

export default function AccountPage() {
  const router = useRouter();
  const { status, busy, error, signIn, register, resetPassword, clearError, watch } = useAuth();
  const items = useCloset((state) => state.items);

  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => watch(), [watch]);
  useEffect(() => {
    if (status === 'signed-in') router.replace('/profile');
  }, [status, router]);

  if (!firebaseReady()) {
    return (
      <>
        <PageHeader title="Accounts" back large={false} />
        <EmptyState
          icon={<CloudOff size={26} />}
          title="No backend configured"
          body="Accounts and backup need a Firebase project. Everything else works without one — your wardrobe is on this device."
        />
        <div className="mx-5 rounded-2xl bg-[var(--surface-alt)] p-4">
          <p className="text-label mb-2 text-[var(--text-muted)]">Missing from .env.local</p>
          <ul className="space-y-1">
            {missingFirebaseConfig().map((key) => (
              <li key={key} className="font-mono text-[0.75rem] text-[var(--text-muted)]">
                {key}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
            The steps are in the project README, under <strong>Accounts and backup</strong>.
          </p>
        </div>
      </>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const ok = mode === 'sign-in' ? await signIn(email, password) : await register(email, password);
    if (ok) {
      toast(
        mode === 'sign-in'
          ? 'Signed in — your wardrobe is syncing'
          : 'Account created — your wardrobe is backing up now',
        { tone: 'success' },
      );
      router.replace('/profile');
    }
  }

  return (
    <div className="pb-6">
      <PageHeader
        title={mode === 'sign-in' ? 'Sign in' : 'Create an account'}
        back
        large={false}
        subtitle="So your wardrobe survives a lost phone"
      />

      <div className="space-y-5 px-5">
        <SegmentedControl<Mode>
          value={mode}
          onChange={(next) => {
            setMode(next);
            clearError();
          }}
          options={[
            { value: 'sign-in', label: 'Sign in' },
            { value: 'register', label: 'Create account' },
          ]}
        />

        <form onSubmit={submit} className="space-y-4">
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              required
              placeholder="you@example.com"
            />
          </Field>
          <Field
            label="Password"
            hint={mode === 'register' ? 'At least six characters.' : undefined}
          >
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              required
              minLength={6}
            />
          </Field>

          {error ? (
            <p className="rounded-2xl bg-[var(--danger-soft)] p-3 text-[0.875rem] leading-relaxed text-[var(--danger)]">
              {error}
            </p>
          ) : null}

          <Button type="submit" full size="lg" disabled={busy || !email || !password}>
            {busy
              ? 'Just a moment…'
              : mode === 'sign-in'
                ? 'Sign in'
                : 'Create account'}
          </Button>
        </form>

        {mode === 'sign-in' ? (
          <button
            type="button"
            disabled={!email || busy}
            onClick={async () => {
              if (await resetPassword(email)) {
                toast('Check your email for a reset link', { tone: 'success' });
              }
            }}
            className="pressable w-full text-center text-[0.875rem] text-[var(--text-muted)] underline underline-offset-2 disabled:opacity-40"
          >
            Forgotten your password?
          </button>
        ) : null}

        {items.length ? (
          <p className="flex items-start gap-2 rounded-2xl bg-[var(--info-soft)] p-3.5 text-[0.875rem] leading-relaxed text-[var(--info)]">
            <ShieldCheck size={16} className="mt-0.5 shrink-0" />
            {mode === 'register'
              ? `The ${pluralize(items.length, 'piece')} already on this device will be uploaded to your new account. Nothing is lost.`
              : `The ${pluralize(items.length, 'piece')} on this device will be merged with whatever is already in the account.`}
          </p>
        ) : null}

        <p className="text-center text-[0.75rem] leading-relaxed text-[var(--text-faint)]">
          Your wardrobe is only ever readable by you. The app keeps working with no account and no
          connection — an account is what makes it survive losing the phone.
        </p>
      </div>
    </div>
  );
}
