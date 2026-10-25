import { ITEM_BY_ID } from './catalog';
/** segmentId: the branch a trinket hangs on. worn: an accessory the spirit has on (one per section). */
export type ShopPurchase = { id: string; itemId: string; price: number; segmentId: string | null; worn?: boolean };
export function shopBalance(earned: number, purchases: readonly ShopPurchase[]): number {
  return Math.max(0, earned - purchases.reduce((sum, item) => sum + item.price, 0));
}
export function buyItem(purchases: readonly ShopPurchase[], earned: number, itemId: string, id: string): ShopPurchase[] | null {
  const item = ITEM_BY_ID.get(itemId);
  if (!item || purchases.some(p => p.id === id) || shopBalance(earned, purchases) < item.price) return null;
  return [...purchases, { id, itemId, price: item.price, segmentId: null }];
}
/** Put an accessory on (taking off whatever else is worn from its section) or take it off. */
export function wearItem(purchases: readonly ShopPurchase[], purchaseId: string, worn: boolean): ShopPurchase[] | null {
  const target = purchases.find(p => p.id === purchaseId);
  const item = target && ITEM_BY_ID.get(target.itemId);
  if (!item || item.kind !== 'accessory') return null;
  return purchases.map(p => {
    if (p.id === purchaseId) return { ...p, worn };
    if (worn && p.worn && ITEM_BY_ID.get(p.itemId)?.section === item.section) return { ...p, worn: false };
    return p;
  });
}
/** Item ids of the accessories the spirit is wearing. */
export function wornItems(purchases: readonly ShopPurchase[]): string[] {
  return purchases.filter(p => p.worn).map(p => p.itemId);
}
export function validPurchases(value: unknown): value is ShopPurchase[] {
  if (!Array.isArray(value) || new Set(value.map(p => p?.id)).size !== value.length) return false;
  const wornSections = new Set<string>();
  return value.every(p => {
    const item = p && ITEM_BY_ID.get(p.itemId);
    if (!item || typeof p.id !== 'string' || p.id.length === 0 || p.price !== item.price) return false;
    if (p.worn !== undefined && typeof p.worn !== 'boolean') return false;
    if (item.kind === 'accessory') {
      if (p.segmentId !== null) return false;
      if (p.worn) {
        if (wornSections.has(item.section)) return false;
        wornSections.add(item.section);
      }
      return true;
    }
    return !p.worn && (p.segmentId === null || typeof p.segmentId === 'string');
  });
}
