import type { Segment } from '../types';
import { tileToPx } from '../world/layout';
import { ITEM_BY_ID } from './catalog';
import type { ShopPurchase } from './inventory';

/** Draw into the world layer so decorations follow its camera and lighting. */
export class TreeDecorations {
  private images = new Map<string, HTMLImageElement>();

  draw(ctx: CanvasRenderingContext2D, purchases: readonly ShopPurchase[], segments: readonly Segment[], onLoad: () => void): void {
    const branches = new Map(segments.filter(s => s.kind === 'branch').map(s => [s.id, s]));
    const counts = new Map<string, number>();
    const groups = new Map<string, number>();
    for (const p of purchases) if (p.segmentId) groups.set(p.segmentId, (groups.get(p.segmentId) ?? 0) + 1);
    for (const p of purchases) {
      if (!p.segmentId) continue;
      const branch = branches.get(p.segmentId);
      const item = ITEM_BY_ID.get(p.itemId);
      if (!branch || !item) continue;
      const index = counts.get(p.segmentId) ?? 0;
      counts.set(p.segmentId, index + 1);
      let image = this.images.get(item.id);
      if (!image) {
        image = new Image();
        image.onload = onLoad;
        image.src = item.image;
        this.images.set(item.id, image);
      }
      if (!image.complete || !image.naturalWidth) continue;
      const at = tileToPx(branch.to);
      const offset = index - ((groups.get(p.segmentId) ?? 1) - 1) / 2;
      const size = item.price >= 18 ? 18 : 12;
      const scale = size / Math.max(image.naturalWidth, image.naturalHeight);
      const w = Math.max(1, Math.round(image.naturalWidth * scale));
      const h = Math.max(1, Math.round(image.naturalHeight * scale));
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, Math.round(at.x + offset * 12 - w / 2), Math.round(at.y + 3), w, h);
      ctx.restore();
    }
  }
}
