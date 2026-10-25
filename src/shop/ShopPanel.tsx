import { useEffect, useRef, useState } from 'react';
import { ACCESSORY_SECTIONS, SHOP_ITEMS, TRINKET_SECTIONS, SECTION_LABELS, ITEM_BY_ID, type ShopSection } from './catalog';
import type { ShopPurchase } from './inventory';
import './shop.css';

type Props = {
  balance: number;
  purchases: readonly ShopPurchase[];
  onBuy: (itemId: string) => void;
  onPlace: (purchaseId: string) => void;
  onStore: (purchaseId: string) => void;
  onWear: (purchaseId: string, worn: boolean) => void;
  onClose: () => void;
};
export default function ShopPanel({ balance, purchases, onBuy, onPlace, onStore, onWear, onClose }: Props) {
  const [section, setSection] = useState<ShopSection | 'owned'>('baubles');
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    close.current?.focus();
    return () => { if (previous instanceof HTMLElement) previous.focus(); };
  }, []);
  const tab = (s: ShopSection) => <button key={s} aria-pressed={section === s} onClick={() => setSection(s)}>{SECTION_LABELS[s]}</button>;
  return (
    <div className="panel shop-panel" role="dialog" aria-label="Shop" onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
      <h2>Shop</h2>
      <p className="shop-intro">Little treasures for your branches, and things for your spirit to wear. Every item is 25 LP or less.</p>
      <p className="shop-balance" role="status">{balance} LP available</p>
      <nav className="shop-sections" aria-label="Item sections">
        <span className="shop-group">For your tree</span>
        {TRINKET_SECTIONS.map(tab)}
        <span className="shop-group">For your spirit</span>
        {ACCESSORY_SECTIONS.map(tab)}
        <span className="shop-group">Yours</span>
        <button aria-pressed={section === 'owned'} onClick={() => setSection('owned')}>My items ({purchases.length})</button>
      </nav>
      {section === 'owned' ? <>
        <p>Click a leafy branch to place a trinket; placed items can be moved for free. Your spirit wears one accessory from each section.</p>
        {purchases.length === 0 && <p>Your collection is waiting for its first treasure.</p>}
        <div className="shop-grid">{purchases.map(p => {
          const item = ITEM_BY_ID.get(p.itemId)!;
          return <article className={p.worn ? 'shop-card shop-card-worn' : 'shop-card'} key={p.id}>
            <img src={item.image} alt="" /><h3>{item.name}</h3>
            {item.kind === 'accessory' ? <>
              <span>{p.worn ? 'Wearing' : 'In your wardrobe'}</span>
              <button onClick={() => onWear(p.id, !p.worn)}>{p.worn ? 'Take off' : 'Wear'}</button>
            </> : <>
              <span>{p.segmentId ? 'On your tree' : 'Ready to place'}</span>
              <button onClick={() => onPlace(p.id)}>{p.segmentId ? 'Move' : 'Place'}</button>
              {p.segmentId && <button onClick={() => onStore(p.id)}>Store</button>}
            </>}
          </article>;
        })}</div>
      </> : <div className="shop-grid">{SHOP_ITEMS.filter(item => item.section === section).map(item => {
        const wear = item.kind === 'accessory';
        return <article className="shop-card" key={item.id}>
          <img src={item.image} alt="" loading="lazy" /><h3>{item.name}</h3>
          <span>{item.price} LP · Owned: {purchases.filter(p => p.itemId === item.id).length}</span>
          <button disabled={balance < item.price} onClick={() => onBuy(item.id)}
            aria-label={`${wear ? 'Buy and wear' : 'Buy'} ${item.name} for ${item.price} LP`}>
            {balance < item.price ? `Need ${item.price - balance} LP` : wear ? 'Buy & wear' : 'Buy'}
          </button>
        </article>;
      })}</div>}
      <button ref={close} className="btn-icon panel-close" onClick={onClose} aria-label="Close shop">×</button>
    </div>
  );
}
