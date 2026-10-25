import { SPIRIT_CELL } from '../world/artLayout';
import type { Point } from '../world/layout';
import { ITEM_BY_ID, type AccessorySection, type ShopItem } from './catalog';

/** The spirit's sheet cell with room around it for what it wears: hats above, wings either side. */
export const DRESS = { w: SPIRIT_CELL.w + 32, h: SPIRIT_CELL.h + 22, cellX: 16, cellY: 18 };
/** Idle frames face the viewer; walking and climbing frames face right (the stage mirrors them for left). */
export type Pose = 'front' | 'side';

/**
 * A box in the sheet cell (31 x 32, feet on the bottom row) that a view of the
 * accessory is shrunk to fit. x is the box's centre; y is its centre, top or
 * bottom as `align` says. `flip` mirrors the view; `view: 'side'` uses the
 * sheet's side view; `stretch` fills the box instead of keeping the art's shape.
 * Pairs (wings, ears, earrings) are two spots: the art is the piece on the
 * viewer's left, mirrored for the right.
 */
type Spot = {
  x: number; y: number; w: number; h: number; align: 'center' | 'top' | 'bottom';
  behind?: boolean; flip?: boolean; view?: 'side'; stretch?: boolean;
};
type Placement = Record<Pose, Spot[]>;

const at = (x: number, y: number, w: number, h: number, more: Partial<Spot> = {}): Spot => ({ x, y, w, h, align: 'center', ...more });
const pair = (x: number, y: number, w: number, h: number, gap: number, more: Partial<Spot> = {}): Spot[] =>
  [at(x - gap, y, w, h, more), at(x + gap, y, w, h, { ...more, flip: true })];

// Measured on the sheet: idle face x 8-21, eyes on rows 14-16, chin row 21, hands at x 5-8 and 22-25 on rows 24-26;
// walking, the leafy crown spans rows 1-13, the eye is at x 19 on rows 14-15 and the back is at x 11.
// First match wins.
const PLACEMENTS: [RegExp, Placement][] = [
  [/^hats\//, { front: [at(15, 8, 22, 20, { align: 'bottom' })], side: [at(16, 6, 22, 20, { align: 'bottom' })] }],
  // Its side view kept a dark patch of the sheet's background, so it is worn front on.
  [/^eyewear\/monocle/, { front: [at(18.5, 16, 8, 10)], side: [at(19.5, 16, 6, 9, { view: 'side', flip: true })] }],
  [/^eyewear\/green-glasses/, { front: [at(15.5, 15.5, 16, 8)], side: [at(19, 15, 9, 6)] }],
  [/^eyewear\//, { front: [at(15.5, 15.5, 16, 8)], side: [at(19.5, 15, 7, 7, { view: 'side', flip: true })] }],
  // Scarves are short of their tails, or they hang to the feet like a bib.
  [/^neckwear\//, { front: [at(15, 19.5, 16, 8, { align: 'top' })], side: [at(16.5, 18, 12, 7, { align: 'top' })] }],
  // Front on, a cape is spread wide enough to show either side of the body.
  [/^backs\/.*cape/, { front: [at(15, 19, 24, 14, { align: 'top', behind: true, stretch: true })], side: [at(11, 17, 13, 16, { align: 'top', behind: true })] }],
  [/^backs\//, { front: [at(15, 22, 22, 16, { behind: true })], side: [at(10.5, 22, 12, 13, { behind: true })] }],
  [/^wings\/cat-ears/, { front: pair(15, 4, 7, 8, 7, { align: 'bottom' }), side: [at(12, 4, 7, 8, { align: 'bottom' })] }],
  [/^wings\/halo/, { front: [at(15, -2, 16, 6)], side: [at(16, -2, 16, 6)] }],
  [/^wings\/lantern/, { front: [at(25, 24, 7, 12, { align: 'top' })], side: [at(21, 21, 7, 12, { align: 'top' })] }],
  [/^wings\/orbs/, { front: [at(27, 8, 7, 7)], side: [at(26, 9, 7, 7)] }],
  [/^wings\/pouch/, { front: [at(21, 28, 8, 8)], side: [at(15, 25, 8, 8)] }],
  [/^wings\//, { front: pair(15, 19, 13, 17, 10, { behind: true }), side: [at(9, 19, 13, 17, { behind: true })] }],
  // The front view's band is solid inside and would hide the face: worn as a pair of side views over the ears.
  [/^jewelry\/(earmuffs|headphones)/, { front: pair(15, 15, 7, 10, 8.5, { view: 'side' }), side: [at(14, 15, 7, 9, { view: 'side' })] }],
  [/^jewelry\/(gem|heart)-necklace/, { front: [at(15, 21, 13, 11, { align: 'top' })], side: [at(17, 19, 9, 8, { align: 'top' })] }],
  [/^jewelry\/spiked-collar/, { front: [at(15, 21.5, 15, 6, { align: 'top' })], side: [at(16.5, 18.5, 11, 5, { align: 'top' })] }],
  [/^jewelry\/gold-earrings/, { front: pair(15, 19, 5, 9, 7.5, { view: 'side' }), side: [at(14, 19, 5, 9, { view: 'side' })] }],
  [/^jewelry\/gold-ring/, { front: [at(6.5, 26, 5, 5)], side: [at(19, 24, 5, 5)] }],
  [/^jewelry\/mini-wings/, { front: [at(15, 20, 28, 12, { behind: true })], side: [at(10, 19, 10, 10, { view: 'side', behind: true })] }],
  [/^jewelry\/daisy/, { front: [at(21, 6, 9, 9)], side: [at(11, 6, 9, 9)] }],
  [/^jewelry\/red-bow/, { front: [at(21, 4, 12, 8)], side: [at(12, 4, 12, 8)] }],
  [/^jewels\/.*bracelet/, { front: [at(6.5, 25, 7, 5)], side: [at(19, 24, 6, 4)] }],
  [/^jewels\/.*(earrings|studs)/, { front: pair(15, 19, 5, 9, 7.5), side: [at(14, 19, 5, 9)] }],
  [/^jewels\/wing-clips/, { front: pair(15, 8, 5, 5, 6), side: [at(12, 7, 5, 5)] }],
  [/^jewels\/small-daisy/, { front: [at(21, 7, 6, 9)], side: [at(11, 7, 6, 9)] }],
  [/^jewels\//, { front: [at(21, 6, 9, 6)], side: [at(11, 6, 9, 6)] }],
];
const FALLBACK: Placement = { front: [at(15, 22, 10, 10)], side: [at(16, 22, 10, 10)] };

/** Later sections are drawn over earlier ones: a hat goes over hair clips, glasses over a scarf's tails. */
const LAYER_ORDER: readonly AccessorySection[] = ['backs', 'wings', 'neckwear', 'jewels', 'jewelry', 'eyewear', 'hats'];

export function placement(itemId: string): Placement {
  return PLACEMENTS.find(([pattern]) => pattern.test(itemId))?.[1] ?? FALLBACK;
}

/** Where a view of `w` x `h` pixels lands in the DRESS canvas for a spot, with the frame's body `shift`. */
export function spotRect(spot: Spot, w: number, h: number, shift: Point): { x: number; y: number } {
  const top = spot.align === 'top' ? spot.y : spot.align === 'bottom' ? spot.y - h : spot.y - h / 2;
  return { x: Math.round(DRESS.cellX + shift.x + spot.x - w / 2), y: Math.round(DRESS.cellY + shift.y + top) };
}

/** The size a view is drawn at: shrunk to fit its spot's box, keeping its shape. */
export function fitSize(spot: Spot, naturalWidth: number, naturalHeight: number): { w: number; h: number } {
  if (spot.stretch) return { w: Math.round(spot.w), h: Math.round(spot.h) };
  const scale = Math.min(spot.w / naturalWidth, spot.h / naturalHeight);
  return { w: Math.max(1, Math.round(naturalWidth * scale)), h: Math.max(1, Math.round(naturalHeight * scale)) };
}

/** Draws the accessories the spirit wears around its frame, so they follow it like the frame itself. */
export class SpiritOutfit {
  private images = new Map<string, HTMLImageElement>();
  private fitted = new Map<string, HTMLCanvasElement>();

  /** One layer of the outfit (behind or in front of the spirit) into a DRESS-sized canvas. */
  draw(ctx: CanvasRenderingContext2D, itemIds: readonly string[], pose: Pose, layer: 'behind' | 'front', shift: Point, onLoad: () => void): void {
    const items = itemIds.map(id => ITEM_BY_ID.get(id)).filter((item): item is ShopItem => item?.kind === 'accessory')
      .sort((a, b) => LAYER_ORDER.indexOf(a.section as AccessorySection) - LAYER_ORDER.indexOf(b.section as AccessorySection));
    for (const item of items) {
      for (const spot of placement(item.id)[pose]) {
        if (Boolean(spot.behind) !== (layer === 'behind')) continue;
        const url = spot.view === 'side' && item.sideImage ? item.sideImage : item.image;
        const image = this.image(url, onLoad);
        if (!image.complete || !image.naturalWidth) continue;
        const { w, h } = fitSize(spot, image.naturalWidth, image.naturalHeight);
        const view = this.fit(url, image, w, h);
        const { x, y } = spotRect(spot, w, h, shift);
        ctx.save();
        if (spot.flip) {
          ctx.translate(x + w, y);
          ctx.scale(-1, 1);
          ctx.drawImage(view, 0, 0);
        } else ctx.drawImage(view, x, y);
        ctx.restore();
      }
    }
  }

  private image(url: string, onLoad: () => void): HTMLImageElement {
    let image = this.images.get(url);
    if (!image) {
      image = new Image();
      image.onload = onLoad;
      image.src = url;
      this.images.set(url, image);
    }
    return image;
  }

  /**
   * The sheet art is painted at no steady pixel scale, so each view is shrunk
   * smoothly to world size once, then its edge snapped back to hard pixels.
   */
  private fit(url: string, image: HTMLImageElement, w: number, h: number): HTMLCanvasElement {
    const key = `${url}:${w}x${h}`;
    let canvas = this.fitted.get(key);
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, 0, 0, w, h);
      const pixels = ctx.getImageData(0, 0, w, h);
      for (let i = 3; i < pixels.data.length; i += 4) pixels.data[i] = pixels.data[i] >= 110 ? 255 : 0;
      ctx.putImageData(pixels, 0, 0);
      this.fitted.set(key, canvas);
    }
    return canvas;
  }
}
