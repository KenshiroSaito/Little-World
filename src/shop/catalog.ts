export const TRINKET_SECTIONS = ['baubles', 'candy', 'lights', 'figurines', 'nature', 'ribbons', 'misc'] as const;
/** Accessories are worn by the spirit, one per section; trinkets hang on branches. */
export const ACCESSORY_SECTIONS = ['hats', 'eyewear', 'neckwear', 'backs', 'wings', 'jewelry', 'jewels'] as const;
export const SHOP_SECTIONS = [...TRINKET_SECTIONS, ...ACCESSORY_SECTIONS] as const;
export type TrinketSection = typeof TRINKET_SECTIONS[number];
export type AccessorySection = typeof ACCESSORY_SECTIONS[number];
export type ShopSection = typeof SHOP_SECTIONS[number];
export const SECTION_LABELS: Record<ShopSection, string> = {
  baubles: 'Baubles', candy: 'Sweet treats', lights: 'Lights', figurines: 'Figurines',
  nature: 'Nature', ribbons: 'Ribbons & bows', misc: 'Curios',
  hats: 'Hats', eyewear: 'Eyewear', neckwear: 'Scarves', backs: 'Packs & capes',
  wings: 'Wings & charms', jewelry: 'Jewelry', jewels: 'Little jewels',
};
const prices: Record<ShopSection, number> = {
  baubles: 5, candy: 8, lights: 10, figurines: 18, nature: 12, ribbons: 6, misc: 20,
  hats: 15, eyewear: 10, neckwear: 8, backs: 15, wings: 20, jewelry: 12, jewels: 6,
};
const premium = /snow-globe|terrarium|dreamcatcher|gingerbread-house|cottage|planet|crystal|moon-and-star|crown|cape|halo|-wings$|gem-necklace/;

export type ShopItem = {
  id: string; section: ShopSection; image: string; name: string; price: number;
  kind: 'trinket' | 'accessory';
  /** Accessories only: the sheet's side view (`<name>-2.png`), when it has one. */
  sideImage?: string;
};

const trinkets = import.meta.glob<string>('../world/assets/trinkets/*/*.png', { eager: true, query: '?url', import: 'default' });
const accessories = import.meta.glob<string>('../world/assets/accessories/*/*.png', { eager: true, query: '?url', import: 'default' });
const parts = (path: string) => {
  const [section, filename] = path.split('/').slice(-2);
  return { section: section as ShopSection, slug: filename.replace('.png', '') };
};
const item = (section: ShopSection, slug: string, image: string, kind: ShopItem['kind']): ShopItem => ({
  id: `${section}/${slug}`, section, image, kind,
  name: slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
  price: premium.test(slug) ? 25 : prices[section],
});

// Each accessory is several views; only the front view (no -N suffix) is for sale.
const accessoryItems = Object.entries(accessories).filter(([path]) => !/-\d+\.png$/.test(path)).map(([path, image]) => {
  const { section, slug } = parts(path);
  const side = accessories[path.replace(/\.png$/, '-2.png')];
  return { ...item(section, slug, image, 'accessory'), ...(side ? { sideImage: side } : {}) };
});
const byId = (a: ShopItem, b: ShopItem) => a.id.localeCompare(b.id);
/** Trinkets first, then accessories. */
export const SHOP_ITEMS: ShopItem[] = [
  ...Object.entries(trinkets).sort(([a], [b]) => a.localeCompare(b)).map(([path, image]) => {
    const { section, slug } = parts(path);
    return item(section, slug, image, 'trinket');
  }),
  ...accessoryItems.sort(byId),
];
export const ITEM_BY_ID = new Map(SHOP_ITEMS.map(item => [item.id, item]));
export const isAccessory = (itemId: string) => ITEM_BY_ID.get(itemId)?.kind === 'accessory';
