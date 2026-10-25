import { useEffect, useRef, useState } from 'react';
import { SHOP_ITEMS, SHOP_SECTIONS, SECTION_LABELS, ITEM_BY_ID, type ShopSection } from './catalog';
import type { ShopPurchase } from './inventory';
import './shop.css';

type Props = {
  balance: number;
  purchases: readonly ShopPurchase[];
  onBuy: (itemId: string) => void;
  onPlace: (purchaseId: string) => void;
  onStore: (purchaseId: string) => void;
  onClose: () => void;
};
export default function ShopPanel({ balance, purchases, onBuy, onPlace, onStore, onClose }: Props) {
  const [section, setSection] = useState<ShopSection | 'owned'>('baubles');
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    close.current?.focus();
    return () => { if (previous instanceof HTMLElement) previous.focus(); };
  }, []);
  return (
    <div className="panel shop-panel" role="dialog" aria-label="Tree shop" onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
      <h2>Tree shop</h2>
      <p className="shop-intro">Little treasures for your branches. Every item is 25 LP or less.</p>
      <p className="shop-balance" role="status">{balance} LP available</p>
      <nav className="shop-sections" aria-label="Item sections">
        {SHOP_SECTIONS.map(s => <button key={s} aria-pressed={section === s} onClick={() => setSection(s)}>{SECTION_LABELS[s]}</button>)}
        <button aria-pressed={section === 'owned'} onClick={() => setSection('owned')}>My items ({purchases.length})</button>
      </nav>
      {section === 'owned' ? <>
        <p>Choose an item, then click a leafy branch to place it. Placed items can be moved for free.</p>
        {purchases.length === 0 && <p>Your collection is waiting for its first treasure.</p>}
        <div className="shop-grid">{purchases.map(p => {
          const item = ITEM_BY_ID.get(p.itemId)!;
          return <article className="shop-card" key={p.id}>
            <img src={item.image} alt="" /><h3>{item.name}</h3>
            <span>{p.segmentId ? 'On your tree' : 'Ready to place'}</span>
            <button onClick={() => onPlace(p.id)}>{p.segmentId ? 'Move' : 'Place'}</button>
            {p.segmentId && <button onClick={() => onStore(p.id)}>Store</button>}
          </article>;
        })}</div>
      </> : <div className="shop-grid">{SHOP_ITEMS.filter(item => item.section === section).map(item => (
        <article className="shop-card" key={item.id}>
          <img src={item.image} alt="" loading="lazy" /><h3>{item.name}</h3>
          <span>{item.price} LP · Owned: {purchases.filter(p => p.itemId === item.id).length}</span>
          <button disabled={balance < item.price} onClick={() => onBuy(item.id)} aria-label={`Buy ${item.name} for ${item.price} LP`}>
            {balance < item.price ? `Need ${item.price - balance} LP` : 'Buy'}
          </button>
        </article>
      ))}</div>}
      <button ref={close} className="btn-icon panel-close" onClick={onClose} aria-label="Close shop">×</button>
    </div>
  );
}
