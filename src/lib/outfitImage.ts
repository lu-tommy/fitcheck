'use client';

import { getPhoto } from '@/db';
import { resolveLayout } from '@/domain/collage';
import { readableTextOn } from '@/domain/color';
import { categoryLabel } from '@/domain/taxonomy';
import type { CollagePlacement, ClothingItem } from '@/types';

/**
 * Rendering an outfit to a picture you can send someone.
 *
 * The same placements that drive the on-screen collage drive this, so what gets
 * shared is exactly what was arranged. Everything is drawn from blobs already
 * in IndexedDB — nothing is uploaded, and it works with no connection.
 */

const WIDTH = 1080;
const HEIGHT = 1350;
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export interface RenderTheme {
  background: string;
  ink: string;
  muted: string;
  panel: string;
}

export const LIGHT_THEME: RenderTheme = {
  background: '#f4f4f2',
  ink: '#1a1714',
  muted: '#7a716a',
  panel: '#ffffff',
};

/** A decoded photo, or the colour to draw in its place. */
type Source = { bitmap: ImageBitmap } | { color: string; label: string };

async function loadSource(item: ClothingItem): Promise<Source> {
  const id = item.cutoutId ?? item.photoId;
  if (id) {
    const photo = await getPhoto(id);
    if (photo) {
      try {
        return { bitmap: await createImageBitmap(photo.blob) };
      } catch {
        // A corrupt blob should cost one tile, not the whole picture.
      }
    }
  }
  return { color: item.primaryColorHex, label: categoryLabel(item.category) };
}

function roundedPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

/** Draw one piece, cover-cropped into its tile, tilted and with a soft shadow. */
function drawPiece(
  context: CanvasRenderingContext2D,
  source: Source,
  placement: CollagePlacement,
  bounds: { x: number; y: number; width: number; height: number },
  theme: RenderTheme,
): void {
  const tileWidth = placement.size * bounds.width;
  const tileHeight = tileWidth * 1.25;
  const centreX = bounds.x + placement.x * bounds.width;
  const centreY = bounds.y + placement.y * bounds.height;

  context.save();
  context.translate(centreX, centreY);
  context.rotate((placement.rotation * Math.PI) / 180);

  context.shadowColor = 'rgba(0,0,0,0.28)';
  context.shadowBlur = tileWidth * 0.16;
  context.shadowOffsetY = tileWidth * 0.05;

  const left = -tileWidth / 2;
  const top = -tileHeight / 2;
  roundedPath(context, left, top, tileWidth, tileHeight, tileWidth * 0.09);
  context.fillStyle = theme.panel;
  context.fill();

  context.shadowColor = 'transparent';
  context.save();
  context.clip();

  if ('bitmap' in source) {
    // Cover: fill the tile, cropping the overflow rather than letterboxing.
    const scale = Math.max(tileWidth / source.bitmap.width, tileHeight / source.bitmap.height);
    const drawWidth = source.bitmap.width * scale;
    const drawHeight = source.bitmap.height * scale;
    context.drawImage(
      source.bitmap,
      left + (tileWidth - drawWidth) / 2,
      top + (tileHeight - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
  } else {
    context.fillStyle = source.color;
    context.fillRect(left, top, tileWidth, tileHeight);
    if (tileWidth > 90) {
      context.fillStyle = readableTextOn(source.color);
      context.font = `600 ${Math.round(tileWidth * 0.11)}px ${FONT}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.globalAlpha = 0.85;
      context.fillText(source.label, 0, 0, tileWidth * 0.86);
      context.globalAlpha = 1;
    }
  }

  context.restore();
  context.restore();
}

async function drawCollage(
  context: CanvasRenderingContext2D,
  items: ClothingItem[],
  layout: CollagePlacement[] | undefined,
  bounds: { x: number; y: number; width: number; height: number },
  theme: RenderTheme,
): Promise<ImageBitmap[]> {
  const placements = resolveLayout(items, layout).sort((a, b) => a.z - b.z);
  const byId = new Map(items.map((item) => [item.id, item]));
  const opened: ImageBitmap[] = [];

  for (const placement of placements) {
    const item = byId.get(placement.itemId);
    if (!item) continue;
    const source = await loadSource(item);
    if ('bitmap' in source) opened.push(source.bitmap);
    drawPiece(context, source, placement, bounds, theme);
  }
  return opened;
}

function canvas(width: number, height: number) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  const context = element.getContext('2d');
  if (!context) throw new Error('This browser cannot render images');
  return { element, context };
}

function toBlob(element: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    element.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not render the image'))),
      'image/png',
    ),
  );
}

/** One outfit, captioned, ready to send. */
export async function renderOutfitImage(
  items: ClothingItem[],
  options: {
    title: string;
    subtitle?: string;
    layout?: CollagePlacement[];
    theme?: RenderTheme;
  },
): Promise<Blob> {
  const theme = options.theme ?? LIGHT_THEME;
  const { element, context } = canvas(WIDTH, HEIGHT);

  context.fillStyle = theme.background;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  const bounds = { x: 72, y: 168, width: WIDTH - 144, height: HEIGHT - 168 - 148 };
  const opened = await drawCollage(context, items, options.layout, bounds, theme);

  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.fillStyle = theme.ink;
  context.font = `700 62px ${FONT}`;
  context.fillText(options.title, 72, 108, WIDTH - 144);

  if (options.subtitle) {
    context.fillStyle = theme.muted;
    context.font = `400 34px ${FONT}`;
    context.fillText(options.subtitle, 72, 150, WIDTH - 144);
  }

  context.fillStyle = theme.muted;
  context.font = `500 28px ${FONT}`;
  context.textAlign = 'center';
  context.fillText('Built from my own wardrobe · FitCheck', WIDTH / 2, HEIGHT - 54);

  opened.forEach((bitmap) => bitmap.close());
  return toBlob(element);
}

/** Two outfits side by side, for when you cannot decide. */
export async function renderComparisonImage(
  left: { items: ClothingItem[]; label: string; layout?: CollagePlacement[] },
  right: { items: ClothingItem[]; label: string; layout?: CollagePlacement[] },
  options: { title?: string; theme?: RenderTheme } = {},
): Promise<Blob> {
  const theme = options.theme ?? LIGHT_THEME;
  const { element, context } = canvas(WIDTH, HEIGHT);

  context.fillStyle = theme.background;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.fillStyle = theme.ink;
  context.font = `700 66px ${FONT}`;
  context.textAlign = 'center';
  context.fillText(options.title ?? 'Which one?', WIDTH / 2, 118);

  const panelWidth = 470;
  const panelHeight = 588;
  const top = 218;
  const gap = WIDTH - panelWidth * 2 - 72 * 2;

  const panels = [
    { side: left, x: 72 },
    { side: right, x: 72 + panelWidth + gap },
  ];

  const opened: ImageBitmap[] = [];
  for (const panel of panels) {
    roundedPath(context, panel.x, top, panelWidth, panelHeight, 28);
    context.fillStyle = theme.panel;
    context.fill();

    context.save();
    roundedPath(context, panel.x, top, panelWidth, panelHeight, 28);
    context.clip();
    opened.push(
      ...(await drawCollage(
        context,
        panel.side.items,
        panel.side.layout,
        { x: panel.x, y: top, width: panelWidth, height: panelHeight },
        theme,
      )),
    );
    context.restore();

    context.fillStyle = theme.ink;
    context.font = `600 40px ${FONT}`;
    context.textAlign = 'center';
    context.fillText(panel.side.label, panel.x + panelWidth / 2, top + panelHeight + 66, panelWidth);
  }

  context.fillStyle = theme.muted;
  context.font = `400 34px ${FONT}`;
  context.textAlign = 'center';
  wrapText(
    context,
    'Both are built from clothes I already own — tell me which.',
    WIDTH / 2,
    top + panelHeight + 150,
    WIDTH - 200,
    46,
  );

  context.font = `500 28px ${FONT}`;
  context.fillText('FitCheck', WIDTH / 2, HEIGHT - 54);

  opened.forEach((bitmap) => bitmap.close());
  return toBlob(element);
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const words = text.split(' ');
  let line = '';
  let offset = 0;
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      context.fillText(line, x, y + offset);
      offset += lineHeight;
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) context.fillText(line, x, y + offset);
}

/**
 * Hand the picture to whatever the device uses for sharing, falling back to a
 * download where the Web Share API cannot take files (every desktop browser,
 * and Safari in some contexts).
 */
export async function shareImage(
  blob: Blob,
  filename: string,
  text: string,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], filename, { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (error) {
      if ((error as Error).name === 'AbortError') return 'cancelled';
      // Anything else falls through to the download path.
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
