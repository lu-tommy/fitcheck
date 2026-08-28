'use client';

import { ShieldCheck, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { Field, Input } from '@/components/ui/Field';
import { pluralize } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { useCloset } from '@/store/closet';
import { toast } from '@/store/toast';

export default function AccountPage() {
  const router = useRouter();
  const { status, busy, error, signIn, watch } = useAuth();
  const items = useCloset((state) => state.items);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => watch(), [watch]);
  useEffect(() => {
    if (status === 'signed-in') router.replace('/profile');
  }, [status, router]);

  if (status === 'unconfigured') {
    return (
      <>
        <PageHeader title="Sign in" back large={false} />
        <EmptyState
          icon={<UserRound size={26} />}
          title="No accounts on this server yet"
          body="Everything still works without one — your wardrobe is on this device. Accounts are what make it survive a lost phone."
        />
        <p className="mx-5 rounded-2xl bg-[var(--surface-alt)] p-4 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
          Add people with <code className="font-mono">npm run add-user</code> and put the line it
          prints into <code className="font-mono">OUTFITAI_USERS</code>. The steps are in the
          README under <strong>Accounts on your own server</strong>.
        </p>
      </>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (await signIn(username, password)) {
      toast('Signed in — your wardrobe is backing up', { tone: 'success' });
      router.replace('/profile');
    }
  }

  return (
    <div className="pb-6">
      <PageHeader
        title="Sign in"
        back
        large={false}
        subtitle="So your wardrobe survives a lost phone"
      />

      <div className="space-y-5 px-5">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Name">
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
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
            <p className="rounded-2xl bg-[var(--danger-soft)] p-3 text-[0.875rem] leading-relaxed text-[var(--danger)]">
              {error}
            </p>
          ) : null}

          <Button type="submit" full size="lg" disabled={busy || !username || !password}>
            {busy ? 'Just a moment…' : 'Sign in'}
          </Button>
        </form>

        {items.length ? (
          <p className="flex items-start gap-2 rounded-2xl bg-[var(--info-soft)] p-3.5 text-[0.875rem] leading-relaxed text-[var(--info)]">
            <ShieldCheck size={16} className="mt-0.5 shrink-0" />
            The {pluralize(items.length, 'piece')} already on this device will be merged into your
            account. Nothing is lost.
          </p>
        ) : null}

        <p className="text-center text-[0.75rem] leading-relaxed text-[var(--text-faint)]">
          Your wardrobe is stored on your own machine and never leaves it. The app keeps working
          with no account and no connection — an account is what makes it survive losing the phone.
        </p>
      </div>
    </div>
  );
}
