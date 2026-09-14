/* ==========================================================================
   MAISON — catalogue
   DESIGN PLACEHOLDER DATA. Names, prices and copy stand in for the real
   inventory so the shop, cart and checkout can be reviewed as a flow.
   Prices are in Iraqi dinar (IQD), the currency the brand posts in.
   Product imagery uses unbranded vessels so real packaging drops in
   without any redesign.
   ========================================================================== */

window.MAISON_CATALOGUE = {

  currency: 'IQD',

  categories: [
    { id: 'all',      key: 'cat.all' },
    { id: 'perfume',  key: 'cat.perfume' },
    { id: 'skincare', key: 'cat.skincare' },
    { id: 'cosmetic', key: 'cat.cosmetic' },
    { id: 'hair',     key: 'cat.hair' }
  ],

  products: [
    {
      id: 'khair',
      cat: 'perfume',
      house: 'perfumes',
      price: 85000,
      size: '50 ml',
      img: 'khair-oud',
      ratio: '4/5',
      feature: true,
      notes: ['signature.note.1', 'signature.note.2', 'signature.note.3']
    },
    {
      id: 'sceptre',
      cat: 'perfume',
      house: 'perfumes',
      price: 95000,
      size: '50 ml',
      img: 'hero-flacon',
      ratio: '16/9',
      feature: true,
      notes: ['note.amber', 'note.vanilla', 'note.cedar']
    },
    {
      id: 'serum-c',
      cat: 'skincare',
      house: 'cosmetic',
      price: 32000,
      size: '30 ml',
      img: 'skincare-set',
      ratio: '4/5',
      feature: true,
      notes: ['science.1.name', 'note.hyaluronic']
    },
    {
      id: 'cream-night',
      cat: 'skincare',
      house: 'cosmetic',
      price: 28000,
      size: '50 ml',
      img: 'texture-macro',
      ratio: '16/9',
      feature: true,
      notes: ['science.3.name', 'note.ceramide']
    },
    {
      id: 'cleanser',
      cat: 'skincare',
      house: 'cosmetic',
      price: 19000,
      size: '150 ml',
      img: 'cleanser',
      ratio: '4/5',
      notes: ['note.gentle', 'note.hyaluronic']
    },
    {
      id: 'eye-cream',
      cat: 'skincare',
      house: 'cosmetic',
      price: 24000,
      size: '15 ml',
      img: 'eye-cream',
      ratio: '4/5',
      notes: ['science.3.name', 'note.caffeine']
    },
    {
      id: 'lip-colour',
      cat: 'cosmetic',
      house: 'cosmetic',
      price: 18000,
      size: '3.5 g',
      img: 'lip-colour',
      ratio: '4/5',
      feature: true,
      notes: ['note.matte', 'note.longwear']
    },
    {
      id: 'hair-oil',
      cat: 'hair',
      house: 'cosmetic',
      price: 22000,
      size: '100 ml',
      img: 'hair-oil',
      ratio: '4/5',
      notes: ['note.argan', 'note.repair']
    }
  ],

  /* Delivery is the brand's real model: across Kurdistan and Iraq. */
  delivery: [
    { id: 'erbil',        fee: 0,    key: 'city.erbil'        },
    { id: 'sulaymaniyah', fee: 5000, key: 'city.sulaymaniyah' },
    { id: 'duhok',        fee: 5000, key: 'city.duhok'        },
    { id: 'kirkuk',       fee: 7000, key: 'city.kirkuk'       },
    { id: 'baghdad',      fee: 8000, key: 'city.baghdad'      },
    { id: 'basra',        fee: 10000, key: 'city.basra'       },
    { id: 'other',        fee: 10000, key: 'city.other'       }
  ],

  freeDeliveryOver: 100000
};
