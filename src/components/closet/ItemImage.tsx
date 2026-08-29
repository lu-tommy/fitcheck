'use client';

import { categoryLabel } from '@/domain/taxonomy';
import { readableTextOn } from '@/domain/color';
import { cn } from '@/lib/cn';
import { usePhotoUrl } from '@/lib/hooks';
import type { ClothingItem } from '@/types';

/**
 * An item's picture, preferring the cut-out so outfit previews sit on the page
 * rather than in a photo. Items with no photo — the demo wardrobe, or anything
 * added by hand — render as a colour block, which keeps a grid of them legible
 * instead of showing a wall of grey placeholders.
 */
export function ItemImage({
  item,
  className,
  preferCutout = true,
  fit = 'cover',
  showLabel = true,
}: {
  item: ClothingItem;
  className?: string;
  preferCutout?: boolean;
  fit?: 'cover' | 'contain';
  /** Set false below about 48px — the category name has nowhere to go and clips. */
  showLabel?: boolean;
}) {
  const photoId = preferCutout ? (item.cutoutId ?? item.photoId) : item.photoId;
  const url = usePhotoUrl(photoId);
  const isCutout = Boolean(preferCutout && item.cutoutId);

  if (!photoId) {
    const background = item.primaryColorHex;
    return (
      <div
        className={cn('grid place-items-center overflow-hidden', className)}
        style={{ background, color: readableTextOn(background) }}
      >
        {showLabel ? (
          <span className="px-2 text-center text-[0.75rem] font-semibold opacity-80">
            {categoryLabel(item.category)}
          </span>
        ) : null}
      </div>
    );
  }

  if (!url) return <div className={cn('skeleton', className)} />;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- blob: URLs cannot go through next/image
    <img
      src={url}
      alt={item.name}
      loading="lazy"
      decoding="async"
      /*
       * An image is draggable by default, so a sideways drag across a garment
       * starts a native image drag — which fires pointercancel and silently
       * kills any swipe gesture built on top of it.
       */
      draggable={false}
      className={cn(
        fit === 'cover' ? 'object-cover' : 'object-contain',
        'size-full',
        isCutout && 'drop-shadow-[0_6px_12px_rgba(0,0,0,0.12)]',
        className,
      )}
    />
  );
}
