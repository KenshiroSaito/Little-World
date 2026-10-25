export const SHOP_SECTIONS = ['baubles', 'candy', 'lights', 'figurines', 'nature', 'ribbons', 'misc'] as const;
export type ShopSection = typeof SHOP_SECTIONS[number];
export const SECTION_LABELS: Record<ShopSection, string> = {
  baubles: 'Baubles', candy: 'Sweet treats', lights: 'Lights', figurines: 'Figurines',
  nature: 'Nature', ribbons: 'Ribbons & bows', misc: 'Curios',
};
const prices: Record<ShopSection, number> = {
  baubles: 5, candy: 8, lights: 10, figurines: 18, nature: 12, ribbons: 6, misc: 20,
};
const premium = /snow-globe|terrarium|dreamcatcher|gingerbread-house|cottage|planet|crystal|moon-and-star/;
const assets = import.meta.glob<string>('../world/assets/trinkets/*/*.png', { eager: true, query: '?url', import: 'default' });
export const SHOP_ITEMS = Object.entries(assets).sort(([a], [b]) => a.localeCompare(b)).map(([path, image]) => {
  const [section, filename] = path.split('/').slice(-2);
  const slug = filename.replace('.png', '');
  return {
    id: `${section}/${slug}`, section: section as ShopSection, image,
    name: slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    price: premium.test(slug) ? 25 : prices[section as ShopSection],
  };
});
export const ITEM_BY_ID = new Map(SHOP_ITEMS.map(item => [item.id, item]));
