'use client';

import { Archive } from 'lucide-react';
import { useMemo } from 'react';

import { ItemTile } from '@/components/closet/ItemTile';
import { PageHeader } from '@/components/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { formatRelative } from '@/lib/date';
import { pluralize } from '@/lib/format';
import { useCloset } from '@/store/closet';

export default function ArchivePage() {
  const items = useCloset((state) => state.items);

  const archived = useMemo(
    () =>
      items
        .filter((item) => item.archived)
        .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? '')),
    [items],
  );

  return (
    <div className="pb-4">
      <PageHeader
        title="Archive"
        back
        large={false}
        subtitle={
          archived.length ? `${pluralize(archived.length, 'piece')} out of circulation` : undefined
        }
      />

      <div className="px-5">
        {!archived.length ? (
          <EmptyState
            icon={<Archive size={26} />}
            title="Nothing archived"
            body="Archiving keeps a piece and its history but takes it out of your closet, outfits and stats — better than deleting something you might miss."
            action={<ButtonLink href="/closet" variant="secondary">Back to closet</ButtonLink>}
          />
        ) : (
          <>
            <p className="mb-4 text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
              These keep their wear history and stay out of everything else. Open one to put it
              back.
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {archived.map((item) => (
                <ItemTile
                  key={item.id}
                  item={item}
                  href={`/closet/${item.id}`}
                  subtitle={`Archived ${formatRelative(item.archivedAt).toLowerCase()}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
