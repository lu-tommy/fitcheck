'use client';

import type { Category } from '@/types';

/**
 * Pictures for the demo wardrobe.
 *
 * Drawn in the browser rather than shipped as files: nothing to download,
 * nothing to keep in the repository, and they theme with the app. They are
 * obviously illustrations, which is the point — a demo should never be mistaken
 * for somebody's real clothes.
 *
 * They are transparent PNGs, not photographs on a backdrop, because that is
 * what a cut-out garment is. Drawn onto a beige rectangle they became paper
 * coasters on a mat; with an alpha channel they sit on the flat lay the same
 * way a real cut-out does, which is also the only honest preview of what the
 * app looks like once somebody has photographed their own wardrobe.
 *
 * Every category gets its own silhouette. A blazer drawn as a t-shirt is worse
 * than no picture at all — it teaches the eye the wrong thing about a screen
 * whose entire job is telling garments apart at a glance.
 */

const W = 400;
const H = 500;

type Shape =
  | 'tee' | 'longsleeve' | 'polo' | 'shirt' | 'tank' | 'knit' | 'hoodie' | 'vest'
  | 'blazer' | 'coat' | 'parka'
  | 'trousers' | 'joggers' | 'shorts' | 'skirt'
  | 'dress' | 'jumpsuit' | 'suit'
  | 'sneaker' | 'boot' | 'derby' | 'sandal'
  | 'cap' | 'beanie' | 'hat'
  | 'raincoat' | 'swimwear' | 'leggings' | 'flats' | 'welly' | 'umbrella'
  | 'watch' | 'belt' | 'necklace' | 'earrings' | 'bracelet' | 'ring' | 'brooch'
  | 'sunglasses' | 'scarf' | 'tie' | 'bowtie' | 'pocketsquare'
  | 'headband' | 'hairclip' | 'socks' | 'tights' | 'bag' | 'gloves';

const SHAPE_OF: Record<Category, Shape> = {
  tshirt: 'tee', polo: 'polo', shirt: 'shirt', blouse: 'shirt', tank: 'tank',
  longsleeve: 'longsleeve', turtleneck: 'longsleeve',
  sweater: 'knit', hoodie: 'hoodie', cardigan: 'knit', vest: 'vest',
  overshirt: 'shirt',
  jacket: 'blazer', blazer: 'blazer', coat: 'coat', parka: 'parka',
  raincoat: 'raincoat',
  dress: 'dress', jumpsuit: 'jumpsuit', suit: 'suit', swimwear: 'swimwear',
  jeans: 'trousers', chinos: 'trousers', 'dress-pants': 'trousers',
  shorts: 'shorts', joggers: 'joggers', leggings: 'leggings', skirt: 'skirt',
  sneakers: 'sneaker', boots: 'boot', 'dress-shoes': 'derby', loafers: 'derby',
  sandals: 'sandal', flats: 'flats', 'rain-boots': 'welly',
  hat: 'hat', cap: 'cap', beanie: 'beanie',
  watch: 'watch', belt: 'belt', necklace: 'necklace', earrings: 'earrings',
  bracelet: 'bracelet', ring: 'ring', brooch: 'brooch',
  sunglasses: 'sunglasses', scarf: 'scarf', tie: 'tie', 'bow-tie': 'bowtie',
  'pocket-square': 'pocketsquare', headband: 'headband', 'hair-clip': 'hairclip',
  socks: 'socks', tights: 'tights', bag: 'bag',
  gloves: 'gloves', umbrella: 'umbrella', other: 'bag',
};

/** What gets drawn: a filled silhouette, optional holes, optional stitch lines. */
interface Drawing {
  body: Path2D;
  /** Punched out of the body — the gap between two legs, the inside of a ring. */
  holes?: Path2D;
  /** Stroked in a darker tone: seams, plackets, laces, a collar edge. */
  lines?: Path2D;
  /** Line weight, when the default 5 is wrong for a small piece. */
  stroke?: number;
}

/*
 * Shared upper-body outline.
 *
 * `sleeve` is how far down the arm reaches and `hem` where the garment ends —
 * between them that is the whole difference between a tee, a shirt and a coat.
 * The armpit is a real corner rather than a smooth side, because a sleeve that
 * merges into the body draws a slab, not a garment.
 */
function torso({ hem, sleeve, width = 68, neck = 26, shoulder = 118 }: {
  hem: number; sleeve: number; width?: number; neck?: number; shoulder?: number;
}): Path2D {
  const p = new Path2D();
  const cx = 200;
  const armpit = Math.min(214, sleeve - 10);
  const cuff = width + 12;

  p.moveTo(cx - neck, 108);
  p.quadraticCurveTo(cx, 134, cx + neck, 108);
  p.lineTo(cx + shoulder * 0.58, 112);
  p.lineTo(cx + shoulder, 128);
  p.lineTo(cx + shoulder - 4, sleeve);
  p.lineTo(cx + cuff, sleeve - 14);
  p.lineTo(cx + width, armpit);
  p.lineTo(cx + width, hem);
  p.lineTo(cx - width, hem);
  p.lineTo(cx - width, armpit);
  p.lineTo(cx - cuff, sleeve - 14);
  p.lineTo(cx - shoulder + 4, sleeve);
  p.lineTo(cx - shoulder, 128);
  p.lineTo(cx - shoulder * 0.58, 112);
  p.closePath();
  return p;
}

/*
 * Trousers, shorts and joggers. The outline walks down one leg, up its inner
 * edge to the crotch and back down the other, so the gap between the legs is
 * part of the silhouette rather than a hole punched afterwards.
 */
function legs({ top, hem, rise, waist = 72, ankle, cuffed = false }: {
  top: number; hem: number; rise: number; waist?: number; ankle: number; cuffed?: boolean;
}): Drawing {
  const p = new Path2D();
  const cx = 200;
  p.moveTo(cx - waist, top);
  p.lineTo(cx + waist, top);
  p.lineTo(cx + ankle, hem);
  p.lineTo(cx + 12, hem);
  p.lineTo(cx + 5, rise);
  p.lineTo(cx - 5, rise);
  p.lineTo(cx - 12, hem);
  p.lineTo(cx - ankle, hem);
  p.closePath();

  const lines = new Path2D();
  lines.moveTo(cx - waist + 2, top + 24);
  lines.lineTo(cx + waist - 2, top + 24);
  if (cuffed) {
    lines.moveTo(cx + ankle - 2, hem - 22); lines.lineTo(cx + 13, hem - 22);
    lines.moveTo(cx - ankle + 2, hem - 22); lines.lineTo(cx - 13, hem - 22);
  }
  return { body: p, lines };
}

function build(shape: Shape): Drawing {
  const cx = 200;

  switch (shape) {
    case 'tee':
      return { body: torso({ hem: 372, sleeve: 214, width: 74 }) };

    case 'longsleeve':
      return { body: torso({ hem: 372, sleeve: 340, width: 70, shoulder: 108 }) };

    case 'tank': {
      const p = new Path2D();
      p.moveTo(cx - 62, 108); p.lineTo(cx - 30, 112);
      p.quadraticCurveTo(cx, 146, cx + 30, 112);
      p.lineTo(cx + 62, 108); p.lineTo(cx + 70, 200);
      p.lineTo(cx + 66, 366); p.lineTo(cx - 66, 366); p.lineTo(cx - 70, 200);
      p.closePath();
      return { body: p };
    }

    case 'polo': {
      const body = torso({ hem: 368, sleeve: 216, width: 74 });
      const lines = new Path2D();
      lines.moveTo(cx - 28, 110); lines.lineTo(cx - 12, 152); lines.lineTo(cx, 132);
      lines.lineTo(cx + 12, 152); lines.lineTo(cx + 28, 110);
      lines.moveTo(cx - 11, 150); lines.lineTo(cx - 11, 196);
      return { body, lines };
    }

    case 'shirt': {
      const body = torso({ hem: 380, sleeve: 344, width: 72, shoulder: 106 });
      const lines = new Path2D();
      // Collar, then the placket down the middle with buttons on it.
      lines.moveTo(cx - 34, 106); lines.lineTo(cx - 10, 150); lines.lineTo(cx + 2, 124);
      lines.moveTo(cx + 34, 106); lines.lineTo(cx + 10, 150); lines.lineTo(cx - 2, 124);
      lines.moveTo(cx, 150); lines.lineTo(cx, 376);
      for (let y = 186; y < 360; y += 44) {
        lines.moveTo(cx - 7, y); lines.arc(cx, y, 7, Math.PI, -Math.PI);
      }
      // Cuffs.
      lines.moveTo(cx - 100, 322); lines.lineTo(cx - 74, 318);
      lines.moveTo(cx + 100, 322); lines.lineTo(cx + 74, 318);
      return { body, lines, stroke: 4 };
    }

    case 'knit': {
      const body = torso({ hem: 372, sleeve: 348, width: 80, neck: 30, shoulder: 112 });
      const lines = new Path2D();
      // Ribbing reads as knitwear at a glance, which is the only job here.
      for (let y = 348; y <= 368; y += 10) { lines.moveTo(cx - 78, y); lines.lineTo(cx + 78, y); }
      lines.moveTo(cx - 30, 112); lines.quadraticCurveTo(cx, 136, cx + 30, 112);
      return { body, lines, stroke: 4 };
    }

    case 'hoodie': {
      const body = torso({ hem: 376, sleeve: 344, width: 82, neck: 34, shoulder: 114 });
      const lines = new Path2D();
      lines.moveTo(cx - 52, 112);
      lines.quadraticCurveTo(cx, 96, cx + 52, 112);
      lines.quadraticCurveTo(cx, 172, cx - 52, 112);
      // Kangaroo pocket.
      lines.moveTo(cx - 62, 268); lines.lineTo(cx - 54, 322); lines.lineTo(cx + 54, 322);
      lines.lineTo(cx + 62, 268);
      lines.moveTo(cx - 14, 146); lines.lineTo(cx - 14, 196);
      lines.moveTo(cx + 14, 146); lines.lineTo(cx + 14, 196);
      return { body, lines, stroke: 4 };
    }

    case 'vest': {
      // Armholes cut in from the shoulder, which is the only thing separating a
      // waistcoat from a sleeveless top at this size.
      const p = new Path2D();
      p.moveTo(cx - 30, 112);
      p.lineTo(cx - 76, 116);
      p.quadraticCurveTo(cx - 96, 180, cx - 82, 232);
      p.lineTo(cx - 78, 384);
      p.lineTo(cx + 78, 384);
      p.lineTo(cx + 82, 232);
      p.quadraticCurveTo(cx + 96, 180, cx + 76, 116);
      p.lineTo(cx + 30, 112);
      p.lineTo(cx, 206);
      p.closePath();
      const lines = new Path2D();
      lines.moveTo(cx, 206); lines.lineTo(cx, 380);
      for (let y = 250; y < 360; y += 40) { lines.moveTo(cx - 9, y); lines.arc(cx, y, 9, Math.PI, -Math.PI); }
      return { body: p, lines, stroke: 4 };
    }

    case 'blazer':
    case 'coat':
    case 'parka': {
      const hem = shape === 'blazer' ? 386 : shape === 'coat' ? 430 : 410;
      const width = shape === 'parka' ? 92 : 80;
      const body = torso({ hem, sleeve: 352, width, neck: 40, shoulder: 116 });
      const lines = new Path2D();
      // An open front with lapels is what makes outerwear read as outerwear.
      lines.moveTo(cx, 150); lines.lineTo(cx, hem - 4);
      lines.moveTo(cx - 44, 108); lines.lineTo(cx - 8, 208); lines.lineTo(cx - 2, 150);
      lines.moveTo(cx + 44, 108); lines.lineTo(cx + 8, 208); lines.lineTo(cx + 2, 150);
      if (shape === 'parka') {
        // A visible hood and a drawstring, or a parka is just a long jacket.
        lines.moveTo(cx - 62, 120); lines.quadraticCurveTo(cx, 62, cx + 62, 120);
        lines.moveTo(cx - 46, 176); lines.lineTo(cx + 46, 176);
        lines.moveTo(cx - 66, 322); lines.lineTo(cx - 26, 322);
        lines.moveTo(cx + 66, 322); lines.lineTo(cx + 26, 322);
      } else if (shape === 'coat') {
        // A belt across the waist is the fastest read for "long coat".
        lines.moveTo(cx - 82, 286); lines.lineTo(cx + 82, 286);
        lines.moveTo(cx - 82, 314); lines.lineTo(cx + 82, 314);
        lines.moveTo(cx - 62, 356); lines.lineTo(cx - 24, 356);
        lines.moveTo(cx + 62, 356); lines.lineTo(cx + 24, 356);
      } else {
        lines.moveTo(cx - 62, 300); lines.lineTo(cx - 24, 300);
        lines.moveTo(cx + 62, 300); lines.lineTo(cx + 24, 300);
      }
      return { body, lines, stroke: 4 };
    }

    case 'dress': {
      const p = new Path2D();
      p.moveTo(cx - 58, 108); p.lineTo(cx - 26, 112);
      p.quadraticCurveTo(cx, 146, cx + 26, 112);
      p.lineTo(cx + 58, 108); p.lineTo(cx + 68, 216);
      p.lineTo(cx + 124, 424); p.quadraticCurveTo(cx, 448, cx - 124, 424);
      p.lineTo(cx - 68, 216); p.closePath();
      const lines = new Path2D();
      lines.moveTo(cx - 66, 236); lines.quadraticCurveTo(cx, 258, cx + 66, 236);
      return { body: p, lines };
    }

    case 'jumpsuit': {
      const p = new Path2D();
      p.moveTo(cx - 58, 108); p.lineTo(cx - 26, 112);
      p.quadraticCurveTo(cx, 146, cx + 26, 112);
      p.lineTo(cx + 58, 108); p.lineTo(cx + 70, 220);
      p.lineTo(cx + 62, 424); p.lineTo(cx + 8, 424); p.lineTo(cx, 300);
      p.lineTo(cx - 8, 424); p.lineTo(cx - 62, 424); p.lineTo(cx - 70, 220);
      p.closePath();
      const lines = new Path2D();
      lines.moveTo(cx - 68, 234); lines.lineTo(cx + 68, 234);
      return { body: p, lines };
    }

    case 'suit': {
      // The jacket has to overlap the trousers or the two read as separate
      // garments floating one above the other.
      const body = torso({ hem: 268, sleeve: 262, width: 76, neck: 38, shoulder: 108 });
      const trousers = legs({ top: 250, hem: 476, rise: 356, waist: 72, ankle: 60 });
      const merged = new Path2D();
      merged.addPath(body); merged.addPath(trousers.body);
      const lines = new Path2D();
      lines.moveTo(cx, 148); lines.lineTo(cx, 262);
      lines.moveTo(cx - 38, 108); lines.lineTo(cx - 8, 184); lines.lineTo(cx - 2, 148);
      lines.moveTo(cx + 38, 108); lines.lineTo(cx + 8, 184); lines.lineTo(cx + 2, 148);
      lines.moveTo(cx - 70, 274); lines.lineTo(cx + 70, 274);
      return { body: merged, lines, stroke: 4 };
    }

    case 'trousers':
      return legs({ top: 122, hem: 432, rise: 268, waist: 76, ankle: 58 });

    case 'joggers':
      return legs({ top: 122, hem: 414, rise: 264, waist: 78, ankle: 44, cuffed: true });

    case 'shorts':
      return legs({ top: 148, hem: 326, rise: 254, waist: 82, ankle: 70 });

    case 'skirt': {
      const p = new Path2D();
      p.moveTo(cx - 70, 148); p.lineTo(cx + 70, 148);
      p.lineTo(cx + 118, 372); p.quadraticCurveTo(cx, 394, cx - 118, 372);
      p.closePath();
      const lines = new Path2D();
      lines.moveTo(cx - 72, 174); lines.lineTo(cx + 72, 174);
      return { body: p, lines };
    }

    case 'sneaker': {
      const p = new Path2D();
      p.moveTo(96, 320); p.quadraticCurveTo(104, 214, 168, 214);
      p.quadraticCurveTo(206, 214, 226, 262);
      p.quadraticCurveTo(250, 290, 306, 300);
      p.quadraticCurveTo(324, 306, 324, 322);
      p.quadraticCurveTo(324, 336, 300, 336);
      p.lineTo(112, 336); p.quadraticCurveTo(96, 336, 96, 320);
      p.closePath();
      const lines = new Path2D();
      lines.moveTo(98, 312); lines.lineTo(322, 312);           // sole
      for (let i = 0; i < 4; i += 1) {                          // laces
        lines.moveTo(150 + i * 18, 232 + i * 12);
        lines.lineTo(186 + i * 18, 246 + i * 12);
      }
      return { body: p, lines, stroke: 4 };
    }

    case 'boot': {
      const p = new Path2D();
      p.moveTo(140, 154); p.lineTo(236, 154);
      p.quadraticCurveTo(240, 254, 250, 288);
      p.quadraticCurveTo(300, 300, 316, 312);
      p.quadraticCurveTo(326, 320, 322, 336);
      p.lineTo(146, 336); p.quadraticCurveTo(134, 260, 140, 154);
      p.closePath();
      const lines = new Path2D();
      lines.moveTo(142, 318); lines.lineTo(322, 318);
      lines.moveTo(142, 182); lines.lineTo(238, 182);
      return { body: p, lines, stroke: 4 };
    }

    case 'derby': {
      const p = new Path2D();
      p.moveTo(104, 300); p.quadraticCurveTo(110, 240, 176, 238);
      p.quadraticCurveTo(232, 238, 268, 268);
      p.quadraticCurveTo(310, 292, 320, 306);
      p.quadraticCurveTo(326, 320, 306, 320);
      p.lineTo(118, 320); p.quadraticCurveTo(104, 318, 104, 300);
      p.closePath();
      const lines = new Path2D();
      lines.moveTo(150, 264); lines.quadraticCurveTo(196, 244, 240, 268);
      return { body: p, lines, stroke: 4 };
    }

    case 'sandal': {
      // Straps are part of the silhouette. As stroked lines they were clipped
      // inside the sole and the whole thing read as a flat blob.
      const p = new Path2D();
      p.moveTo(104, 300); p.quadraticCurveTo(104, 276, 144, 274);
      p.lineTo(296, 280); p.quadraticCurveTo(326, 282, 326, 300);
      p.quadraticCurveTo(326, 320, 296, 320); p.lineTo(142, 322);
      p.quadraticCurveTo(104, 322, 104, 300); p.closePath();
      // Two crossing straps arching above the sole.
      p.moveTo(140, 276);
      p.quadraticCurveTo(196, 208, 262, 274);
      p.lineTo(240, 280);
      p.quadraticCurveTo(194, 236, 158, 282);
      p.closePath();
      p.moveTo(190, 232);
      p.quadraticCurveTo(258, 250, 300, 282);
      p.lineTo(292, 296);
      p.quadraticCurveTo(246, 262, 182, 248);
      p.closePath();
      return { body: p };
    }

    case 'cap': {
      const p = new Path2D();
      p.moveTo(112, 268); p.quadraticCurveTo(112, 172, 208, 172);
      p.quadraticCurveTo(300, 172, 300, 268);
      p.lineTo(300, 276); p.quadraticCurveTo(360, 278, 362, 300);
      p.quadraticCurveTo(362, 312, 316, 310); p.lineTo(112, 292);
      p.closePath();
      const lines = new Path2D();
      lines.moveTo(208, 174); lines.lineTo(208, 280);
      return { body: p, lines, stroke: 4 };
    }

    case 'beanie': {
      const p = new Path2D();
      p.moveTo(116, 296); p.quadraticCurveTo(112, 168, 200, 168);
      p.quadraticCurveTo(290, 168, 286, 296); p.closePath();
      const lines = new Path2D();
      lines.moveTo(114, 268); lines.lineTo(288, 268);
      lines.moveTo(158, 178); lines.lineTo(150, 268);
      lines.moveTo(242, 178); lines.lineTo(250, 268);
      return { body: p, lines, stroke: 4 };
    }

    case 'hat': {
      const p = new Path2D();
      p.ellipse(200, 292, 138, 40, 0, 0, Math.PI * 2);
      p.moveTo(130, 284); p.quadraticCurveTo(126, 178, 200, 178);
      p.quadraticCurveTo(274, 178, 270, 284); p.closePath();
      const lines = new Path2D();
      lines.moveTo(132, 262); lines.quadraticCurveTo(200, 280, 268, 262);
      return { body: p, lines, stroke: 5 };
    }

    case 'watch': {
      // No punched hole: the dial has to stay solid or the hands drawn on it
      // are erased along with it.
      const p = new Path2D();
      p.roundRect(172, 128, 56, 116, 18);
      p.roundRect(172, 262, 56, 116, 18);
      p.ellipse(200, 254, 74, 74, 0, 0, Math.PI * 2);
      const lines = new Path2D();
      lines.moveTo(258, 254); lines.arc(200, 254, 58, 0, Math.PI * 2);
      lines.moveTo(200, 254); lines.lineTo(200, 212);
      lines.moveTo(200, 254); lines.lineTo(232, 268);
      return { body: p, lines, stroke: 5 };
    }

    case 'belt': {
      const p = new Path2D();
      p.roundRect(88, 232, 232, 42, 10);
      p.roundRect(300, 218, 60, 70, 12);
      const holes = new Path2D();
      holes.roundRect(314, 232, 32, 42, 8);
      const lines = new Path2D();
      for (let x = 128; x < 260; x += 34) { lines.moveTo(x, 244); lines.lineTo(x, 262); }
      return { body: p, holes, lines, stroke: 4 };
    }

    case 'necklace': {
      const p = new Path2D();
      p.ellipse(200, 236, 92, 92, 0, 0, Math.PI * 2);
      const holes = new Path2D();
      holes.ellipse(200, 236, 78, 78, 0, 0, Math.PI * 2);
      const pendant = new Path2D();
      pendant.addPath(p);
      pendant.ellipse(200, 342, 26, 26, 0, 0, Math.PI * 2);
      return { body: pendant, holes };
    }

    case 'bracelet': {
      const p = new Path2D();
      p.ellipse(200, 250, 96, 74, 0, 0, Math.PI * 2);
      const holes = new Path2D();
      holes.ellipse(200, 250, 74, 54, 0, 0, Math.PI * 2);
      return { body: p, holes };
    }

    case 'ring': {
      // The stone has to sit *on* the band, not hover above it.
      const p = new Path2D();
      p.ellipse(200, 292, 70, 70, 0, 0, Math.PI * 2);
      // A kite-shaped stone, widest where it meets the band.
      p.moveTo(200, 158); p.lineTo(248, 218); p.lineTo(200, 262); p.lineTo(152, 218);
      p.closePath();
      const holes = new Path2D();
      holes.ellipse(200, 292, 48, 48, 0, 0, Math.PI * 2);
      return { body: p, holes };
    }

    case 'sunglasses': {
      const p = new Path2D();
      p.roundRect(76, 214, 112, 78, 22);
      p.roundRect(212, 214, 112, 78, 22);
      p.rect(186, 232, 28, 12);
      p.rect(60, 218, 20, 10);
      p.rect(320, 218, 20, 10);
      return { body: p };
    }

    case 'scarf': {
      // One connected piece: a loop across the top with both tails hanging out
      // of it. Drawn as three shapes it read as a moustache over two sticks.
      const p = new Path2D();
      p.moveTo(96, 148);
      p.quadraticCurveTo(200, 244, 304, 148);
      p.lineTo(330, 196);
      p.quadraticCurveTo(268, 258, 254, 268);
      p.lineTo(254, 392);
      p.lineTo(206, 392);
      p.lineTo(206, 262);
      p.lineTo(194, 262);
      p.lineTo(194, 392);
      p.lineTo(146, 392);
      p.lineTo(146, 268);
      p.quadraticCurveTo(132, 258, 70, 196);
      p.closePath();
      const lines = new Path2D();
      for (let y = 356; y <= 384; y += 13) {
        lines.moveTo(148, y); lines.lineTo(192, y);
        lines.moveTo(208, y); lines.lineTo(252, y);
      }
      return { body: p, lines, stroke: 4 };
    }

    case 'tie': {
      const p = new Path2D();
      p.moveTo(174, 132); p.lineTo(226, 132); p.lineTo(240, 186);
      p.lineTo(214, 206); p.lineTo(238, 356); p.lineTo(200, 400);
      p.lineTo(162, 356); p.lineTo(186, 206); p.lineTo(160, 186);
      p.closePath();
      const lines = new Path2D();
      lines.moveTo(162, 190); lines.lineTo(238, 190);
      return { body: p, lines, stroke: 4 };
    }

    case 'earrings': {
      // A pair, laid the way they sit in a dish: the hoop, and the drop
      // swinging out of it. One earring on its own reads as a pendant.
      const p = new Path2D();
      const holes = new Path2D();
      for (const cx of [142, 258]) {
        p.ellipse(cx, 168, 30, 30, 0, 0, Math.PI * 2);
        p.moveTo(cx, 196);
        p.quadraticCurveTo(cx + 46, 262, cx + 32, 314);
        p.quadraticCurveTo(cx, 356, cx - 32, 314);
        p.quadraticCurveTo(cx - 46, 262, cx, 196);
        p.closePath();
        holes.ellipse(cx, 168, 17, 17, 0, 0, Math.PI * 2);
      }
      return { body: p, holes };
    }

    case 'brooch': {
      // The bar behind it is what makes this a thing that fastens to a lapel
      // rather than a pendant on a missing chain.
      const p = new Path2D();
      p.roundRect(96, 240, 216, 16, 8);
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2;
        p.ellipse(200 + Math.cos(angle) * 54, 248 + Math.sin(angle) * 54, 40, 40, 0, 0, Math.PI * 2);
      }
      p.ellipse(200, 248, 46, 46, 0, 0, Math.PI * 2);
      const holes = new Path2D();
      holes.ellipse(200, 248, 22, 22, 0, 0, Math.PI * 2);
      return { body: p, holes };
    }

    case 'bowtie': {
      const p = new Path2D();
      p.moveTo(56, 176);
      p.quadraticCurveTo(46, 250, 56, 324);
      p.lineTo(180, 278); p.lineTo(180, 222); p.closePath();
      p.moveTo(344, 176);
      p.quadraticCurveTo(354, 250, 344, 324);
      p.lineTo(220, 278); p.lineTo(220, 222); p.closePath();
      p.roundRect(176, 206, 48, 88, 12);
      const lines = new Path2D();
      lines.moveTo(76, 204); lines.quadraticCurveTo(120, 250, 76, 296);
      lines.moveTo(324, 204); lines.quadraticCurveTo(280, 250, 324, 296);
      return { body: p, lines, stroke: 4 };
    }

    case 'pocketsquare': {
      // Three peaks out of a fold, which is how one sits in a breast pocket. A
      // flat square reads as a napkin.
      const p = new Path2D();
      p.moveTo(96, 332);
      p.lineTo(122, 196); p.lineTo(160, 300);
      p.lineTo(200, 150); p.lineTo(240, 300);
      p.lineTo(278, 196); p.lineTo(304, 332);
      p.closePath();
      const lines = new Path2D();
      lines.moveTo(102, 306); lines.lineTo(298, 306);
      return { body: p, lines, stroke: 4 };
    }

    case 'headband': {
      // Open at the bottom, because a closed ring is a bracelet.
      const p = new Path2D();
      const from = Math.PI * 0.78;
      const to = Math.PI * 2.22;
      p.moveTo(200 + Math.cos(from) * 108, 268 + Math.sin(from) * 108);
      p.arc(200, 268, 108, from, to, false);
      p.lineTo(200 + Math.cos(to) * 78, 268 + Math.sin(to) * 78);
      p.arc(200, 268, 78, to, from, true);
      p.closePath();
      return { body: p };
    }

    case 'hairclip': {
      // A claw clip: two jaws hinged at the top, teeth meeting down the open
      // side. Drawn as one jaw it was a comma.
      const p = new Path2D();
      p.moveTo(120, 138); p.quadraticCurveTo(70, 268, 132, 386);
      p.lineTo(178, 372); p.quadraticCurveTo(126, 264, 168, 152); p.closePath();
      p.moveTo(280, 138); p.quadraticCurveTo(330, 268, 268, 386);
      p.lineTo(222, 372); p.quadraticCurveTo(274, 264, 232, 152); p.closePath();
      const lines = new Path2D();
      for (let y = 194; y <= 336; y += 34) {
        lines.moveTo(150, y); lines.lineTo(184, y + 6);
        lines.moveTo(250, y); lines.lineTo(216, y + 6);
      }
      return { body: p, lines, stroke: 4 };
    }

    case 'socks': {
      // A pair laid flat, toes the same way, ribbing at the cuff — the ribbing
      // is the whole difference between a sock and a boot.
      const p = new Path2D();
      const lines = new Path2D();
      for (const cx of [120, 268] as const) {
        p.moveTo(cx - 34, 128);
        p.lineTo(cx + 34, 128);
        p.lineTo(cx + 34, 302);
        p.quadraticCurveTo(cx + 38, 340, cx + 74, 346);
        p.quadraticCurveTo(cx + 94, 350, cx + 92, 372);
        p.quadraticCurveTo(cx + 90, 392, cx + 60, 392);
        p.lineTo(cx - 34, 392);
        p.quadraticCurveTo(cx - 40, 350, cx - 34, 302);
        p.closePath();
        for (let y = 142; y <= 184; y += 14) {
          lines.moveTo(cx - 30, y);
          lines.lineTo(cx + 30, y);
        }
      }
      return { body: p, lines, stroke: 4 };
    }

    case 'tights': {
      // Trouser-shaped but drawn thin, because the point of them is that they
      // are hosiery and not a pair of leggings.
      const p = new Path2D();
      p.moveTo(140, 108);
      p.lineTo(260, 108);
      p.lineTo(250, 214); p.lineTo(238, 396); p.lineTo(212, 396);
      p.lineTo(200, 238);
      p.lineTo(188, 396); p.lineTo(162, 396); p.lineTo(150, 214);
      p.closePath();
      const lines = new Path2D();
      lines.moveTo(142, 144); lines.lineTo(258, 144);
      return { body: p, lines, stroke: 5 };
    }

    case 'raincoat': {
      // A hood is the whole point of it, and the only thing that separates a
      // raincoat from a coat at a glance.
      const p = torso({ hem: 380, sleeve: 300, width: 92, neck: 30, shoulder: 126 });
      p.moveTo(168, 118);
      p.quadraticCurveTo(200, 62, 232, 118);
      p.quadraticCurveTo(200, 100, 168, 118);
      p.closePath();
      const lines = new Path2D();
      lines.moveTo(200, 130); lines.lineTo(200, 380);
      for (let y = 200; y <= 320; y += 60) { lines.moveTo(190, y); lines.lineTo(210, y); }
      return { body: p, lines, stroke: 4 };
    }

    case 'swimwear': {
      // A one-piece: high leg, scooped front, thin straps.
      const p = new Path2D();
      p.moveTo(146, 140);
      p.quadraticCurveTo(200, 190, 254, 140);
      p.lineTo(268, 150);
      p.quadraticCurveTo(292, 260, 246, 330);
      p.quadraticCurveTo(200, 286, 154, 330);
      p.quadraticCurveTo(108, 260, 132, 150);
      p.closePath();
      const lines = new Path2D();
      lines.moveTo(150, 146); lines.quadraticCurveTo(200, 200, 250, 146);
      return { body: p, lines, stroke: 4 };
    }

    case 'leggings': {
      // Trouser-shaped and drawn tight to the leg, which is the difference.
      const p = new Path2D();
      p.moveTo(146, 112); p.lineTo(254, 112);
      p.lineTo(246, 220); p.lineTo(236, 396); p.lineTo(210, 396);
      p.lineTo(200, 246);
      p.lineTo(190, 396); p.lineTo(164, 396); p.lineTo(154, 220);
      p.closePath();
      const lines = new Path2D();
      lines.moveTo(148, 150); lines.lineTo(252, 150);
      return { body: p, lines, stroke: 5 };
    }

    case 'flats': {
      // Low, round, and no heel — which is the entire distinction from a pump.
      const p = new Path2D();
      p.moveTo(96, 300);
      p.quadraticCurveTo(96, 250, 150, 250);
      p.quadraticCurveTo(206, 250, 262, 276);
      p.quadraticCurveTo(312, 296, 312, 316);
      p.quadraticCurveTo(312, 336, 268, 336);
      p.lineTo(130, 336);
      p.quadraticCurveTo(96, 336, 96, 300);
      p.closePath();
      const lines = new Path2D();
      lines.moveTo(132, 262); lines.quadraticCurveTo(168, 292, 214, 296);
      return { body: p, lines, stroke: 5 };
    }

    case 'welly': {
      // Tall, straight-sided and flat-soled: a boot with no shape to it.
      const p = new Path2D();
      p.moveTo(146, 120); p.lineTo(232, 120);
      p.lineTo(238, 300);
      p.quadraticCurveTo(240, 322, 286, 328);
      p.quadraticCurveTo(322, 334, 320, 362);
      p.quadraticCurveTo(318, 384, 276, 384);
      p.lineTo(146, 384);
      p.quadraticCurveTo(138, 300, 140, 220);
      p.closePath();
      const lines = new Path2D();
      lines.moveTo(146, 160); lines.lineTo(234, 160);
      lines.moveTo(146, 360); lines.lineTo(300, 360);
      return { body: p, lines, stroke: 5 };
    }

    case 'umbrella': {
      // Canopy, ribs and a crook handle.
      const p = new Path2D();
      p.moveTo(70, 250);
      p.quadraticCurveTo(80, 120, 200, 120);
      p.quadraticCurveTo(320, 120, 330, 250);
      p.quadraticCurveTo(300, 226, 265, 250);
      p.quadraticCurveTo(232, 224, 200, 250);
      p.quadraticCurveTo(168, 224, 135, 250);
      p.quadraticCurveTo(100, 226, 70, 250);
      p.closePath();
      p.rect(194, 128, 12, 232);
      p.moveTo(194, 344);
      p.quadraticCurveTo(148, 344, 148, 386);
      p.lineTo(172, 386);
      p.quadraticCurveTo(172, 366, 206, 366);
      p.closePath();
      const lines = new Path2D();
      lines.moveTo(135, 246); lines.quadraticCurveTo(160, 140, 200, 124);
      lines.moveTo(265, 246); lines.quadraticCurveTo(240, 140, 200, 124);
      return { body: p, lines, stroke: 4 };
    }

    case 'gloves': {
      // A pair, each with four fingers and a thumb off the side — all joined to
      // the hand, so it does not read as a bundle of loose sticks.
      const p = new Path2D();
      for (const originX of [128, 212]) {
        const flip = originX === 128 ? -1 : 1;
        p.roundRect(originX - 4, 226, 64, 148, 20);
        for (let f = 0; f < 4; f += 1) {
          const x = originX + 1 + f * 15;
          const top = 168 + Math.abs(f - 1.5) * 13;
          p.roundRect(x, top, 13, 240 - top, 6);
        }
        p.roundRect(originX + (flip < 0 ? -30 : 60), 244, 34, 17, 8);
      }
      return { body: p };
    }

    case 'bag':
    default: {
      const p = new Path2D();
      p.moveTo(108, 226); p.lineTo(292, 226);
      p.quadraticCurveTo(306, 226, 308, 244);
      p.lineTo(322, 374); p.quadraticCurveTo(324, 392, 306, 392);
      p.lineTo(94, 392); p.quadraticCurveTo(76, 392, 78, 374);
      p.lineTo(92, 244); p.quadraticCurveTo(94, 226, 108, 226);
      p.closePath();
      const handle = new Path2D();
      handle.moveTo(146, 228);
      handle.quadraticCurveTo(146, 140, 200, 140);
      handle.quadraticCurveTo(254, 140, 254, 228);
      return { body: p, lines: handle, stroke: 12 };
    }
  }
}

/** hex -> rgb, then a straight mix toward black or white. */
function mix(hex: string, amount: number): string {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const n = Number.parseInt(full, 16);
  const target = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  const channel = (shift: number) => {
    const c = (n >> shift) & 0xff;
    return Math.round(c + (target - c) * t);
  };
  return `rgb(${channel(16)} ${channel(8)} ${channel(0)})`;
}

/**
 * The tightest box the silhouette actually occupies.
 *
 * Every shape is authored in whatever coordinates read clearly while writing
 * it, which leaves a belt drawn small and wide and a coat drawn tall. Measuring
 * the alpha and scaling to fit means each garment fills its own frame, so the
 * flat lay's own sizing — a hat smaller than a coat — is the only thing
 * deciding how big a piece looks.
 */
function boundsOf(drawing: Drawing): { x: number; y: number; w: number; h: number } | null {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.fillStyle = '#000';
  context.fill(drawing.body);
  if (drawing.lines) {
    context.strokeStyle = '#000';
    context.lineWidth = (drawing.stroke ?? 5) + 2;
    context.stroke(drawing.lines);
  }

  const { data } = context.getImageData(0, 0, W, H);
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (data[(y * W + x) * 4 + 3] < 8) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** One illustration, as a transparent PNG ready for the photo store. */
export async function demoPhoto(category: Category, hex: string): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const drawing = build(SHAPE_OF[category] ?? 'bag');
  const { body, holes, lines, stroke = 5 } = drawing;

  // Scale the silhouette up to fill its frame, keeping its proportions. Line
  // weights are divided back out so a belt's stitching does not thicken with it.
  const box = boundsOf(drawing);
  let scale = 1;
  if (box) {
    scale = Math.min((W * 0.94) / box.w, (H * 0.94) / box.h);
    context.translate(W / 2, H / 2);
    context.scale(scale, scale);
    context.translate(-(box.x + box.w / 2), -(box.y + box.h / 2));
  }
  const line = (weight: number) => weight / scale;

  context.fillStyle = hex;
  context.fill(body);

  // Light from the upper left, and a little weight along the bottom edge, so a
  // flat fill reads as cloth rather than a sticker.
  context.save();
  context.clip(body);
  const sheen = context.createLinearGradient(60, 80, 340, 460);
  sheen.addColorStop(0, 'rgba(255,255,255,0.20)');
  sheen.addColorStop(0.45, 'rgba(255,255,255,0.02)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.16)');
  context.fillStyle = sheen;
  context.fillRect(-W, -H, W * 3, H * 3);

  if (lines) {
    context.strokeStyle = mix(hex, -0.3);
    context.globalAlpha = 0.65;
    context.lineWidth = line(stroke);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.stroke(lines);
    context.globalAlpha = 1;
  }
  context.restore();

  // Strokes that leave the silhouette — a bag handle — are drawn outside the
  // clip or they simply vanish.
  if (lines && SHAPE_OF[category] === 'bag') {
    context.strokeStyle = mix(hex, -0.25);
    context.lineWidth = line(stroke);
    context.lineCap = 'round';
    context.stroke(lines);
  }

  if (holes) {
    context.globalCompositeOperation = 'destination-out';
    context.fill(holes);
    context.globalCompositeOperation = 'source-over';
  }

  // A hairline edge keeps a white shirt from disappearing into a pale ground.
  context.strokeStyle = mix(hex, -0.22);
  context.globalAlpha = 0.4;
  context.lineWidth = line(2);
  context.stroke(body);
  context.globalAlpha = 1;

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
