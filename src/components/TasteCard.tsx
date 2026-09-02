'use client';

import { Archive, Heart, Link2, Undo2, X } from 'lucide-react';
import { useMemo } from 'react';

import { describeEvidence, readTaste, type Observation } from '@/domain/taste';
import { cn } from '@/lib/cn';
import { useActiveItems, useCloset } from '@/store/closet';
import { useOutfits } from '@/store/outfits';
import { usePreferences } from '@/store/preferences';
import { useTaste } from '@/store/taste';
import { toast } from '@/store/toast';
import { todayKey } from '@/lib/date';

/**
 * What the app has worked out, in sentences.
 *
 * This screen is the price of being allowed to have opinions at all. The engine
 * now nudges outfits towards what somebody actually reaches for, and a nudge
 * you cannot see is indistinguishable from the app being broken — so every
 * inference it holds is written here in plain words, with the count it rests
 * on, an offer to act on it, and a way to say it is wrong.
 *
 * Nothing here happens on its own. Archiving, favouriting and adding a colour
 * to the avoid list are all one tap by a person, never a decision by the app.
 */
export function TasteCard({ className }: { className?: string }) {
  const items = useActiveItems();
  const updateItem = useCloset((state) => state.updateItem);
  const wearLogs = useOutfits((state) => state.wearLogs);
  const signals = useTaste((state) => state.signals);
  const forgetItem = useTaste((state) => state.forgetItem);
  const forgetAll = useTaste((state) => state.forgetAll);
  const preferences = usePreferences((state) => state.preferences);
  const updatePreferences = usePreferences((state) => state.update);

  const today = todayKey();
  const taste = useMemo(
    () => readTaste(signals, items, wearLogs, today, preferences.dismissedObservations),
    [signals, items, wearLogs, today, preferences.dismissedObservations],
  );

  async function act(observation: Observation) {
    const action = observation.action;
    if (!action) return;

    if (action.kind === 'archive') {
      await updateItem(action.itemId, { archived: true, archivedAt: new Date().toISOString() });
      toast('Archived — it keeps its photo and its history');
    } else if (action.kind === 'favourite') {
      await updateItem(action.itemId, { favorite: true });
      toast('Marked a favourite');
    } else {
      const avoid = [...new Set([...preferences.avoidColors, action.colour])];
      await updatePreferences({ avoidColors: avoid });
      toast(`${action.colour} will stop coming up`);
    }
    await dismiss(observation);
  }

  /*
   * Dismissing hides the sentence AND unlearns the item it was about. Hiding it
   * alone would leave the engine quietly acting on something the wearer has
   * just said out loud is wrong, which is the exact failure this screen exists
   * to prevent.
   */
  async function dismiss(observation: Observation) {
    const dismissed = [...new Set([...(preferences.dismissedObservations ?? []), observation.key])];
    await updatePreferences({ dismissedObservations: dismissed });
  }

  async function disagree(observation: Observation) {
    await Promise.all(observation.itemIds.map((id) => forgetItem(id)));
    await dismiss(observation);
    toast('Forgotten. It will start again from nothing.');
  }

  return (
    <section className={cn('card overflow-hidden', className)}>
      <div className="border-b border-[var(--border)] px-4 py-3.5">
        <p className="text-[0.9375rem] font-medium">What FitCheck has picked up</p>
        <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
          {describeEvidence(taste, items)}
        </p>
      </div>

      {taste.observations.length === 0 ? (
        <p className="px-4 py-4 text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
          Nothing it is confident enough to say yet. It waits for a pattern rather than
          reading something into one swap, so this stays empty for a while — and that is
          the intended behaviour, not a fault.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {taste.observations.map((observation) => (
            <li key={observation.key} className="px-4 py-3.5">
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full',
                    observation.kind === 'avoided' || observation.kind === 'colour'
                      ? 'bg-[var(--warning-soft)] text-[var(--warning)]'
                      : 'bg-[var(--success-soft)] text-[var(--success)]',
                  )}
                >
                  {observation.kind === 'pairing' ? (
                    <Link2 size={13} />
                  ) : observation.kind === 'favoured' ? (
                    <Heart size={13} />
                  ) : (
                    <Archive size={13} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.9375rem] leading-snug font-medium">
                    {observation.headline}
                  </p>
                  <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
                    {observation.detail}
                  </p>

                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {observation.action ? (
                      <button
                        type="button"
                        onClick={() => void act(observation)}
                        className="pressable rounded-full bg-[var(--brand)] px-3 py-1.5 text-[0.8125rem] font-semibold text-[var(--on-brand)]"
                      >
                        {observation.action.label}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void disagree(observation)}
                      className="pressable inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-alt)] px-3 py-1.5 text-[0.8125rem] font-medium text-[var(--text-muted)]"
                    >
                      <X size={13} />
                      That is wrong
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {taste.evidence > 0 ? (
        <div className="border-t border-[var(--border)] px-4 py-3">
          <button
            type="button"
            onClick={async () => {
              await forgetAll();
              await updatePreferences({ dismissedObservations: [] });
              toast('Forgotten. Outfits go back to the plain rules.');
            }}
            className="pressable inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--text-muted)]"
          >
            <Undo2 size={14} />
            Forget everything it has learned
          </button>
        </div>
      ) : null}
    </section>
  );
}
