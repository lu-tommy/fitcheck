'use client';

import { ArrowUp, MessageCircleQuestion, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { ItemTile } from '@/components/closet/ItemTile';
import { PageHeader } from '@/components/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState, Spinner } from '@/components/ui/Feedback';
import { cn } from '@/lib/cn';
import { formatTemperatureLong } from '@/lib/format';
import { useActiveItems, useResolvedItems } from '@/store/closet';
import { usePreferences } from '@/store/preferences';
import { useStylist } from '@/store/stylist';
import { useWeather } from '@/store/weather';
import type { StylistMessage } from '@/types';

const STARTERS = [
  'What should I wear today?',
  'How can I style my jeans?',
  'What shoes match my blue shirt?',
  'Can I wear this to work?',
  'What am I missing for winter?',
];

export default function StylistPage() {
  const items = useActiveItems();
  const { thread, pending, ask, clear } = useStylist();
  const weather = useWeather((state) => state.snapshot);
  const units = usePreferences((state) => state.preferences.units);
  const [draft, setDraft] = useState('');
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [thread.length, pending]);

  function send(question: string) {
    if (!question.trim()) return;
    setDraft('');
    void ask(
      question,
      items,
      weather
        ? `${formatTemperatureLong(weather.temperature, units)}, ${weather.condition}`
        : undefined,
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader
        title="Stylist"
        subtitle="Answers grounded in your closet"
        action={
          thread.length ? (
            <button
              type="button"
              onClick={() => void clear()}
              aria-label="Clear conversation"
              className="pressable grid size-9 place-items-center rounded-full bg-[var(--surface-alt)] text-[var(--text-muted)]"
            >
              <Trash2 size={16} />
            </button>
          ) : null
        }
      />

      <div className="flex-1 space-y-4 px-5">
        {!items.length ? (
          <EmptyState
            icon={<MessageCircleQuestion size={26} />}
            title="Add clothes first"
            body="The stylist only talks about pieces you own, so it needs something to work with."
            action={<ButtonLink href="/add">Add clothing</ButtonLink>}
          />
        ) : !thread.length ? (
          <>
            <EmptyState
              icon={<MessageCircleQuestion size={26} />}
              title="Ask about anything you own"
              body="It answers from your closet — never with something you would have to go and buy."
            />
            <div className="flex flex-wrap justify-center gap-2">
              {STARTERS.map((starter) => (
                <Chip key={starter} onClick={() => send(starter)}>
                  {starter}
                </Chip>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            {thread.map((message) => (
              <Bubble key={message.id} message={message} />
            ))}
            {pending ? (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-[var(--surface-alt)] px-4 py-3 text-[var(--text-muted)]">
                  <Spinner label="Thinking" />
                </div>
              </div>
            ) : null}
          </div>
        )}
        <div ref={bottom} />
      </div>

      {items.length ? (
        <div
          className="sticky bottom-0 mt-4 border-t border-[var(--border)] bg-[var(--bg)]/92 px-5 pt-3 backdrop-blur-xl"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 5rem)' }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              send(draft);
            }}
            className="flex items-end gap-2"
          >
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  send(draft);
                }
              }}
              rows={1}
              placeholder="Ask about your wardrobe"
              className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[0.9375rem] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
            />
            <Button
              type="submit"
              disabled={!draft.trim() || pending}
              aria-label="Send"
              className="size-11 shrink-0 rounded-full p-0"
            >
              <ArrowUp size={19} />
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function Bubble({ message }: { message: StylistMessage }) {
  const referenced = useResolvedItems(message.referencedItemIds);
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex flex-col', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3 text-[0.9375rem] leading-relaxed whitespace-pre-wrap',
          isUser
            ? 'bg-[var(--brand)] text-[var(--on-brand)]'
            : 'bg-[var(--surface)] border border-[var(--border)]',
        )}
      >
        {message.text}
      </div>
      {!isUser && referenced.length ? (
        <div className="scroll-row -mx-5 mt-2.5 flex w-[calc(100%+2.5rem)] gap-2.5 px-5">
          {referenced.map((item) => (
            <ItemTile
              key={item.id}
              item={item}
              href={`/closet/${item.id}`}
              className="w-24 shrink-0"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
