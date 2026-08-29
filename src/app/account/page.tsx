'use client';

import { ShieldCheck, UserRound } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { WardrobeMark } from '@/components/WardrobeMark';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { Field, Input } from '@/components/ui/Field';
import { pluralize } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { useCloset } from '@/store/closet';
import { toast } from '@/store/toast';

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="skeleton m-5 h-80 rounded-[var(--radius-card)]" />}>
      <SignIn />
    </Suspense>
  );
}

function SignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Land back where they were headed before the gate stopped them.
  const next = searchParams.get('next') || '/';
  const { status, busy, error, signIn, watch } = useAuth();
  const items = useCloset((state) => state.items);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => watch(), [watch]);
  useEffect(() => {
    if (status === 'signed-in') router.replace(next);
  }, [status, router, next]);

  if (status === 'unconfigured') {
    return (
      <>
        <PageHeader title="Sign in" large={false} />
        <EmptyState
          icon={<UserRound size={26} />}
          title="No accounts on this server yet"
          body="Nobody can sign in until somebody is added on the server."
        />
        <p className="mx-5 rounded-2xl bg-[var(--surface-alt)] p-4 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
          Add people with <code className="font-mono">npm run add-user</code> and put the line it
          prints into <code className="font-mono">FITCHECK_USERS</code>. The steps are in the
          README under <strong>Accounts on your own server</strong>.
        </p>
      </>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (await signIn(username, password)) {
      toast('Signed in — your wardrobe is backing up', { tone: 'success' });
      router.replace(next);
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col justify-center overflow-hidden px-6 py-10">
      {/*
        The one screen with nothing on it to look at, and the first one anyone
        ever sees. A lay of the app's own line work, large and nearly invisible,
        says what this is before a word is read — and it is drawn, so it costs
        nothing to download and themes itself.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_50%_-10%,var(--surface)_0%,transparent_65%)]"
      />
      <div className="relative mx-auto w-full max-w-sm">
        <header className="mb-8 text-center">
          <span
            aria-hidden
            className="mx-auto mb-6 block w-full max-w-[15rem] rounded-[1.75rem] bg-[var(--brand)] px-8 py-7 shadow-[var(--shadow-card)]"
          >
            <WardrobeMark className="text-[var(--on-brand)] opacity-90" />
          </span>
          <h1 className="text-display">FitCheck</h1>
          <p className="mx-auto mt-2 max-w-[19rem] text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
            Outfits built only from the clothes hanging in your own wardrobe.
          </p>
        </header>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Name">
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              autoFocus
              required
              placeholder="Lia"
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>

          {error ? (
            <p
              role="alert"
              className="rounded-2xl bg-[var(--danger-soft)] p-3 text-[0.875rem] leading-relaxed text-[var(--danger)]"
            >
              {error}
            </p>
          ) : null}

          <Button type="submit" full size="lg" disabled={busy || !username || !password}>
            {busy ? 'Just a moment…' : 'Sign in'}
          </Button>
        </form>

        {items.length ? (
          <p className="mt-5 flex items-start gap-2 rounded-2xl bg-[var(--info-soft)] p-3.5 text-[0.875rem] leading-relaxed text-[var(--info)]">
            <ShieldCheck size={16} className="mt-0.5 shrink-0" />
            The {pluralize(items.length, 'piece')} already on this device will be merged into your
            account. Nothing is lost.
          </p>
        ) : null}

        <p className="mt-8 text-center text-[0.75rem] leading-relaxed text-[var(--text-faint)]">
          Your wardrobe is stored on your own machine and never leaves it. Once you are signed in it
          works offline too.
        </p>
      </div>
    </div>
  );
}
