import { describe, expect, it } from 'vitest';
import { SHOP_ITEMS, SHOP_SECTIONS } from './catalog';
import { buyItem, shopBalance, validPurchases, wearItem, wornItems } from './inventory';
import { DRESS, fitSize, placement, spotRect } from './outfit';

describe('tree shop', () => {
  it('offers existing art in every section at prices no higher than 25 LP', () => {
    expect(SHOP_ITEMS.length).toBeGreaterThan(100);
    expect(new Set(SHOP_ITEMS.map(item => item.id)).size).toBe(SHOP_ITEMS.length);
    for (const section of SHOP_SECTIONS) expect(SHOP_ITEMS.some(item => item.section === section)).toBe(true);
    for (const item of SHOP_ITEMS) expect(item.price > 0 && item.price <= 25).toBe(true);
  });
  it('charges once per purchase and rejects overspending or unknown items', () => {
    const item = SHOP_ITEMS[0];
    const purchases = buyItem([], item.price, item.id, 'first')!;
    expect(shopBalance(item.price, purchases)).toBe(0);
    expect(buyItem(purchases, item.price, item.id, 'second')).toBeNull();
    expect(buyItem(purchases, 100, item.id, 'first')).toBeNull();
    expect(buyItem([], 100, 'missing', 'first')).toBeNull();
    expect(buyItem([], item.price - 1, item.id, 'first')).toBeNull();
  });
  it('validates saved inventory and rejects altered prices', () => {
    const item = SHOP_ITEMS[0];
    const purchases = buyItem([], 25, item.id, 'first')!;
    expect(validPurchases(purchases)).toBe(true);
    expect(validPurchases([{ ...purchases[0], price: 0 }])).toBe(false);
    expect(validPurchases([...purchases, ...purchases])).toBe(false);
    expect(validPurchases([null])).toBe(false);
  });
});

import { gameReducer, initialGameState } from '../state/gameReducer';
import { isValidGameState } from '../state/persistence';
import { buildTree } from '../game/buildTree';
import { inscriptions, totalLP, revealedRelics } from '../game/progression';
import { TreeDecorations } from './decorations';
import { vi } from 'vitest';

describe('shop integration', () => {
  function grownTree() {
    let state = initialGameState;
    for (let i = 0; i < 8; i++) state = gameReducer(state, { type: 'record', activityId: 'walk', now: `2026-10-25T${String(i + 10).padStart(2, '0')}:00:00.000Z` });
    return state;
  }
  it('spends LP without changing growth, activities, or relics', () => {
    const before = grownTree();
    const item = SHOP_ITEMS.find(item => item.price === 25)!;
    const after = gameReducer(before, { type: 'buyItem', itemId: item.id, id: 'purchase' });
    expect(totalLP(after)).toBe(40);
    expect(shopBalance(totalLP(after), after.shopPurchases!)).toBe(15);
    expect(after.selfCareLogs).toBe(before.selfCareLogs);
    expect(buildTree(after.selfCareLogs)).toEqual(buildTree(before.selfCareLogs));
    expect(revealedRelics(after)).toEqual(revealedRelics(before));
    expect(gameReducer(after, { type: 'buyItem', itemId: item.id, id: 'another' })).toBe(after);
  });
  it('places only purchased items on existing branches, moves and stores for free', () => {
    const state = gameReducer(grownTree(), { type: 'buyItem', itemId: SHOP_ITEMS[0].id, id: 'purchase' });
    const segments = buildTree(state.selfCareLogs);
    const branches = segments.filter(s => s.kind === 'branch');
    expect(gameReducer(state, { type: 'placeItem', purchaseId: 'missing', segmentId: branches[0].id })).toBe(state);
    expect(gameReducer(state, { type: 'placeItem', purchaseId: 'purchase', segmentId: segments.find(s => s.kind === 'root')!.id })).toBe(state);
    const placed = gameReducer(state, { type: 'placeItem', purchaseId: 'purchase', segmentId: branches[0].id });
    const moved = gameReducer(placed, { type: 'placeItem', purchaseId: 'purchase', segmentId: branches[1].id });
    expect(moved.shopPurchases![0].segmentId).toBe(branches[1].id);
    const stored = gameReducer(moved, { type: 'placeItem', purchaseId: 'purchase', segmentId: null });
    expect(stored.shopPurchases![0]).toEqual(state.shopPurchases![0]);
  });
  it('round trips inventory and placements, supports old saves, and resets inventory', () => {
    expect(isValidGameState(initialGameState)).toBe(true);
    let state = gameReducer(grownTree(), { type: 'buyItem', itemId: SHOP_ITEMS[0].id, id: 'purchase' });
    state = gameReducer(state, { type: 'placeItem', purchaseId: 'purchase', segmentId: buildTree(state.selfCareLogs)[0].id });
    const saved = JSON.parse(JSON.stringify(state));
    expect(isValidGameState(saved)).toBe(true);
    expect(saved.shopPurchases).toEqual(state.shopPurchases);
    expect(isValidGameState({ ...state, selfCareLogs: [] })).toBe(false);
    expect(gameReducer(state, { type: 'reset' }).shopPurchases ?? []).toEqual([]);
  });
  it('draws purchased art at its branch and skips stored items', () => {
    const loaded = vi.fn();
    class TestImage {
      complete = true;
      naturalWidth = 48;
      naturalHeight = 60;
      src = '';
      onload = loaded;
    }
    vi.stubGlobal('Image', TestImage);
    try {
      const ctx = { save: vi.fn(), restore: vi.fn(), drawImage: vi.fn(), imageSmoothingEnabled: true };
      const state = grownTree();
      const branches = buildTree(state.selfCareLogs);
      const purchases = [{ id: 'p', itemId: SHOP_ITEMS[0].id, price: SHOP_ITEMS[0].price, segmentId: branches[0].id }];
      const layer = new TreeDecorations();
      layer.draw(ctx as unknown as CanvasRenderingContext2D, purchases, branches, loaded);
      expect(ctx.drawImage).toHaveBeenCalledTimes(1);
      expect(ctx.drawImage.mock.calls[0].slice(1).every(Number.isFinite)).toBe(true);
      layer.draw(ctx as unknown as CanvasRenderingContext2D, [{ ...purchases[0], segmentId: null }], branches, loaded);
      expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); }
  });
});

describe('spirit accessories', () => {
  const hat = SHOP_ITEMS.find(item => item.id === 'hats/top-hat')!;
  const cap = SHOP_ITEMS.find(item => item.id === 'hats/red-cap')!;
  const glasses = SHOP_ITEMS.find(item => item.id === 'eyewear/sunglasses')!;
  it('sells accessories as their front view only, at most 25 LP', () => {
    const accessories = SHOP_ITEMS.filter(item => item.kind === 'accessory');
    expect(accessories.length).toBeGreaterThan(50);
    expect(accessories.every(item => !/-\d+$/.test(item.id) && item.price <= 25)).toBe(true);
    expect(SHOP_ITEMS[0].kind).toBe('trinket');
  });
  it('wears one accessory per section and never hangs one on a branch', () => {
    let purchases = buyItem([], 100, hat.id, 'hat')!;
    purchases = buyItem(purchases, 100, cap.id, 'cap')!;
    purchases = buyItem(purchases, 100, glasses.id, 'glasses')!;
    purchases = wearItem(purchases, 'hat', true)!;
    purchases = wearItem(purchases, 'glasses', true)!;
    purchases = wearItem(purchases, 'cap', true)!;
    expect(wornItems(purchases).sort()).toEqual([glasses.id, cap.id].sort());
    expect(validPurchases(purchases)).toBe(true);
    expect(validPurchases(purchases.map(p => ({ ...p, worn: true })))).toBe(false);
    expect(wearItem(purchases, 'missing', true)).toBeNull();
    let state = gameReducer(initialGameState, { type: 'record', activityId: 'walk', now: '2026-10-25T10:00:00.000Z' });
    state = { ...state, shopPurchases: purchases };
    const branch = buildTree(state.selfCareLogs).find(s => s.kind === 'branch')!;
    expect(gameReducer(state, { type: 'placeItem', purchaseId: 'hat', segmentId: branch.id })).toBe(state);
    expect(SHOP_ITEMS.filter(item => item.kind === 'trinket').every(item => !buyItem([], 25, item.id, 'x')![0].worn)).toBe(true);
  });
  it('places every accessory inside the dressed frame', () => {
    for (const item of SHOP_ITEMS.filter(i => i.kind === 'accessory')) {
      for (const pose of ['front', 'side'] as const) {
        for (const spot of placement(item.id)[pose]) {
          const { w, h } = fitSize(spot, 60, 60);
          const { x, y } = spotRect(spot, w, h, { x: 0, y: 0 });
          expect(x >= 0 && y >= 0 && x + w <= DRESS.w && y + h <= DRESS.h).toBe(true);
        }
      }
    }
  });
});

describe('reflection photos', () => {
  it('keeps up to three photos on reflections only, and lets them be changed later', () => {
    let state = gameReducer(initialGameState, { type: 'record', activityId: 'reflect', now: '2026-10-25T10:00:00.000Z', images: ['a', 'b', 'c', 'd'] });
    state = gameReducer(state, { type: 'record', activityId: 'walk', now: '2026-10-25T11:00:00.000Z', images: ['e'] });
    const [reflect, walk] = state.selfCareLogs;
    expect(reflect.images).toEqual(['a', 'b', 'c']);
    expect(walk.images).toBeUndefined();
    expect(isValidGameState(JSON.parse(JSON.stringify(state)))).toBe(true);
    expect(isValidGameState({ ...state, selfCareLogs: [reflect, { ...walk, images: ['e'] }] })).toBe(false);
    const removed = gameReducer(state, { type: 'setImages', logId: reflect.id, images: [] });
    expect(removed.selfCareLogs[0].images).toBeUndefined();
    expect(gameReducer(state, { type: 'setImages', logId: walk.id, images: ['x'] })).toBe(state);
    const photoOnly = gameReducer(initialGameState, { type: 'record', activityId: 'reflect', now: '2026-10-25T10:00:00.000Z', images: ['p'] });
    expect(inscriptions(photoOnly)).toHaveLength(1);
  });
});
