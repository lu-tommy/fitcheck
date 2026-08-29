'use client';

import { Heart } from 'lucide-react';
import Link from 'next/link';

import { categoryLabel } from '@/domain/taxonomy';
import { cn } from '@/lib/cn';
import type { ClothingItem } from '@/types';

import { ItemImage } from './ItemImage';

export function ItemTile({
  item,
  href,
  onClick,
  selected,
  disabled,
  subtitle,
  className,
}: {
  item: ClothingItem;
  href?: string;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  subtitle?: string;
  className?: string;
}) {
  const body = (
    <>
      <div className="relative aspect-4/5 w-full overflow-hidden rounded-[var(--radius-tile)] bg-[var(--surface-alt)]">
        <ItemImage item={item} className="size-full" />
        {item.favorite ? (
          <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-black/35 text-white backdrop-blur-sm">
            <Heart size={12} fill="currentColor" />
          </span>
        ) : null}
        {item.laundry !== 'clean' ? (
          <span
            className={cn(
              'absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-[0.625rem] font-semibold',
              item.laundry === 'dirty'
                ? 'bg-[var(--danger)] text-white'
                : 'bg-[var(--info)] text-white',
            )}
          >
            {item.laundry === 'dirty' ? 'Dirty' : 'Washing'}
          </span>
        ) : null}
        {selected ? (
          <span className="absolute inset-0 rounded-[var(--radius-tile)] ring-2 ring-[var(--brand)] ring-offset-2 ring-offset-[var(--bg)]" />
        ) : null}
      </div>
      <div className="px-0.5 pt-2">
        <p className="clamp-2 text-[0.8125rem] leading-snug font-medium">{item.name}</p>
        <p className="truncate text-[0.75rem] text-[var(--text-muted)]">
          {subtitle ?? categoryLabel(item.category)}
        </p>
      </div>
    </>
  );

  const shell = cn('pressable block text-left', disabled && 'opacity-40', className);

  if (href) {
    return (
      <Link href={href} className={shell}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={shell}>
      {body}
    </button>
  );
}
