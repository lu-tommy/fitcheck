'use client';

import type { Category } from '@/types';
import { slotOf } from '@/domain/taxonomy';

/**
 * Pictures for the demo wardrobe.
 *
 * Drawn in the browser rather than shipped as files: nothing to download,
 * nothing to keep in the repository, and they theme with the app. They are
 * obviously illustrations, which is the point — a demo should never be mistaken
 * for somebody's real clothes.
 */

const WIDTH = 400;
const HEIGHT = 500;

type Shape = 'top' | 'longtop' | 'bottom' | 'shorts' | 'shoe' | 'boot' | 'hat' | 'small' | 'dress';

function shapeFor(category: Category): Shape {
  if (['boots'].includes(category)) return 'boot';
  if (['sneakers', 'dress-shoes', 'loafers', 'sandals'].includes(category)) return 'shoe';
  if (['hat', 'cap', 'beanie'].includes(category)) return 'hat';
  if (['shorts', 'skirt'].includes(category)) return 'shorts';
  if (['dress', 'jumpsuit'].includes(category)) return 'dress';
  if (['jacket', 'coat', 'parka', 'blazer', 'cardigan', 'suit'].includes(category)) return 'longtop';
  if (slotOf(category) === 'bottom') return 'bottom';
  if (slotOf(category) === 'accessory') return 'small';
  return 'top';
}

function draw(context: CanvasRenderingContext2D, shape: Shape, hex: string): void {
  context.fillStyle = hex;
  const path = new Path2D();

  switch (shape) {
    case 'top':
    case 'longtop': {
      const hem = shape === 'longtop' ? 430 : 380;
      path.moveTo(140, 110);
      path.lineTo(260, 110);
      path.lineTo(330, 160);
      path.lineTo(300, 235);
      path.lineTo(268, 210);
      path.lineTo(268, hem);
      path.lineTo(132, hem);
      path.lineTo(132, 210);
      path.lineTo(100, 235);
      path.lineTo(70, 160);
      path.closePath();
      break;
    }
    case 'dress':
      path.moveTo(150, 110);
      path.lineTo(250, 110);
      path.lineTo(300, 165);
      path.lineTo(272, 220);
      path.lineTo(258, 205);
      path.lineTo(310, 430);
      path.lineTo(90, 430);
      path.lineTo(142, 205);
      path.lineTo(128, 220);
      path.lineTo(100, 165);
      path.closePath();
      break;
    case 'bottom':
      path.rect(135, 110, 130, 90);
      path.rect(135, 200, 58, 230);
      path.rect(207, 200, 58, 230);
      break;
    case 'shorts':
      path.rect(130, 130, 140, 80);
      path.rect(130, 210, 64, 120);
      path.rect(206, 210, 64, 120);
      break;
    case 'shoe':
      path.ellipse(200, 270, 115, 58, -0.1, 0, Math.PI * 2);
      break;
    case 'boot':
      path.moveTo(150, 150);
      path.lineTo(230, 150);
      path.lineTo(230, 290);
      path.lineTo(300, 300);
      path.lineTo(300, 350);
      path.lineTo(150, 350);
      path.closePath();
      break;
    case 'hat':
      path.ellipse(200, 250, 120, 40, 0, 0, Math.PI * 2);
      path.moveTo(140, 250);
      path.arc(200, 245, 60, Math.PI, 0);
      break;
    default:
      path.ellipse(200, 250, 70, 70, 0, 0, Math.PI * 2);
      break;
  }

  context.fill(path);

  // A soft inner shade, so a flat fill reads as cloth rather than a sticker.
  context.save();
  context.clip(path);
  const shade = context.createLinearGradient(0, 80, 0, HEIGHT);
  shade.addColorStop(0, 'rgba(255,255,255,0.16)');
  shade.addColorStop(0.55, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.14)');
  context.fillStyle = shade;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.restore();
}

/** One illustration, as a JPEG blob ready for the photo store. */
export async function demoPhoto(category: Category, hex: string): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const ground = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
  ground.addColorStop(0, '#efece6');
  ground.addColorStop(1, '#e3ded5');
  context.fillStyle = ground;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.save();
  context.shadowColor = 'rgba(0,0,0,0.18)';
  context.shadowBlur = 26;
  context.shadowOffsetY = 12;
  draw(context, shapeFor(category), hex);
  context.restore();

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
}
