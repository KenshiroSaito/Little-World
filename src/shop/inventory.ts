import { ITEM_BY_ID } from './catalog';
export type ShopPurchase = { id: string; itemId: string; price: number; segmentId: string | null };
export function shopBalance(earned: number, purchases: readonly ShopPurchase[]): number {
  return Math.max(0, earned - purchases.reduce((sum, item) => sum + item.price, 0));
}
export function buyItem(purchases: readonly ShopPurchase[], earned: number, itemId: string, id: string): ShopPurchase[] | null {
  const item = ITEM_BY_ID.get(itemId);
  if (!item || purchases.some(p => p.id === id) || shopBalance(earned, purchases) < item.price) return null;
  return [...purchases, { id, itemId, price: item.price, segmentId: null }];
}
export function validPurchases(value: unknown): value is ShopPurchase[] {
  return Array.isArray(value) && new Set(value.map(p => p?.id)).size === value.length && value.every(p =>
    p && typeof p.id === 'string' && p.id.length > 0 && ITEM_BY_ID.has(p.itemId) &&
    p.price === ITEM_BY_ID.get(p.itemId)?.price && (p.segmentId === null || typeof p.segmentId === 'string'));
}
