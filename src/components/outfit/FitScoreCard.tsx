'use client';

import { Minus, Plus, Sparkles } from 'lucide-react';

import type { FitScore } from '@/domain/fitScore';
import { cn } from '@/lib/cn';

/**
 * The score, and every point that made it.
 *
 * A number on its own is a gimmick — people either believe it or dismiss it,
 * and neither teaches anybody anything. Showing the working is what turns it
 * into advice: each line names one rule, in the words somebody would use, and
 * says what to change. The rules that could not be judged are listed too rather
 * than quietly dropped, because "I do not know how those trousers fit" is a
 * more honest thing to say than a confident 74.
 */
export function FitScoreCard({
  report,
  className,
}: {
  report: FitScore;
  className?: string;
}) {
  const notes = [...report.deductions, ...report.credits];

  return (
    <section className={cn('card overflow-hidden', className)}>
      <div className="flex items-center gap-3.5 border-b border-[var(--border)] px-4 py-3.5">
        <p
          className="text-display shrink-0 tabular-nums"
          style={{ fontSize: '2.5rem', lineHeight: 1 }}
        >
          {report.score}
          <span className="text-[0.9375rem] font-normal text-[var(--text-faint)]">/100</span>
        </p>
        <div className="min-w-0">
          <p className="text-title truncate" style={{ fontSize: '1.0625rem' }}>
            {report.verdict}
          </p>
          <div
            className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-alt)]"
            role="img"
            aria-label={`${report.score} out of 100`}
          >
            <span
              className="block h-full rounded-full bg-[var(--brand)] transition-[width] duration-500"
              style={{ width: `${report.score}%` }}
            />
          </div>
        </div>
      </div>

      <ul className="divide-y divide-[var(--border)]">
        {notes.map((note) => (
          <li key={note.rule} className="flex items-start gap-2.5 px-4 py-3">
            <span
              className={cn(
                'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full',
                note.points > 0
                  ? 'bg-[var(--success-soft)] text-[var(--success)]'
                  : 'bg-[var(--danger-soft)] text-[var(--danger)]',
              )}
            >
              {note.points > 0 ? <Plus size={12} /> : <Minus size={12} />}
            </span>
            <p className="min-w-0 text-[0.875rem] leading-relaxed">{note.note}</p>
            <span
              className={cn(
                'ml-auto shrink-0 pt-0.5 text-[0.8125rem] font-semibold tabular-nums',
                note.points > 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]',
              )}
            >
              {note.points > 0 ? `+${note.points}` : note.points}
            </span>
          </li>
        ))}

        {/*
          * What it could not answer, and what would let it. This is the half
          * that gets the wardrobe filled in — a rule that silently skipped
          * itself would never be missed, and never be fixed.
          */}
        {report.unjudged.map((entry) => (
          <li
            key={entry.rule}
            className="flex items-start gap-2.5 bg-[var(--surface-alt)]/50 px-4 py-3"
          >
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[var(--surface-alt)] text-[var(--text-faint)]">
              <Sparkles size={11} />
            </span>
            <p className="min-w-0 text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
              {entry.because}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
