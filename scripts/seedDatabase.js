import { supabaseAdmin } from '../src/config/supabase.js';
import dotenv from 'dotenv';

dotenv.config();

const INITIAL_PRODUCTS = [
  {
    id: 'n19-extrait',
    name: 'LUNE EXTRAIT DE PARFUM',
    french_name: "L'Extrait Flacon Baudruchage",
    category: 'EXTRAIT',
    subtitle: 'FLORENTINE IRIS & GALBANUM ESSENCE',
    price: 340.00,
    in_stock: true,
    badge: 'HAUTE COUTURE',
    rating: 5.0,
    reviews_count: 191,
    image_url: 'https://images.unsplash.com/photo-1547887537-6158d64c35b3?auto=format&fit=crop&w=800&q=80',
    gallery_images: [
      'https://images.unsplash.com/photo-1547887537-6158d64c35b3?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=800&q=80'
    ],
    engraving_available: true,
    gift_box_included: true,
    description: 'The pinnacle of Haute Parfumerie. Formulated with rare Iris Pallida butter cultivated over 6 years in Florence.',
    sizes: [
      { size: '15 ml', price: 240.00, label: '15 ml / 0.5 FL. OZ.' },
      { size: '30 ml', price: 340.00, label: '30 ml / 1.0 FL. OZ.' },
      { size: '50 ml', price: 480.00, label: '50 ml / 1.7 FL. OZ.' }
    ],
    scentDetails: {
      scent_family: 'Florentine Iris Pallida & Rare Galbanum Accord',
      great_for: 'Connoisseurs, gala evenings, intimate luxury',
      the_feel: 'Velvety, radiantly lingering aura with gold-thread hand-sealed Baudruchage',
      scent_profile: 'Green Floral • Velvet Powdery Iris • Earthy Amber',
      top_notes: 'Iranian Galbanum, Neroli de Grasse',
      heart_notes: 'Florentine Iris Pallida, May Rose',
      base_notes: 'Haitian Vetiver, Cedarwood, Oakmoss',
      longevity: '12+ Hours',
      sillage: 'Intimate & Radiantly Refined',
      concentration: '32% Pure Parfum Extrait',
      smells_like: 'A crisp morning dew over Florentine iris fields transitioning into suede notes.',
      who_its_for: 'Designed for individuals who demand uncompromising craftsmanship.',
      how_it_evolves: 'Opens with sharp green galbanum brightness, blooms into velvety Iris Pallida.'
    }
  },
  {
    id: 'n19-edp',
    name: 'LUNE EAU DE PARFUM',
    french_name: 'Vaporisateur de Parfum',
    category: 'EAU DE PARFUM',
    subtitle: 'BOLD GREEN FLORAL SPRAY',
    price: 185.00,
    in_stock: true,
    badge: 'SIGNATURE BESTSELLER',
    rating: 4.9,
    reviews_count: 142,
    image_url: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=800&q=80',
    gallery_images: [
      'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=800&q=80'
    ],
    engraving_available: true,
    gift_box_included: true,
    description: 'An unapologetic statement of green sophistication and floral depth.',
    sizes: [
      { size: '50 ml', price: 145.00, label: '50 ml / 1.7 FL. OZ.' },
      { size: '100 ml', price: 185.00, label: '100 ml / 3.4 FL. OZ.' }
    ],
    scentDetails: {
      scent_family: 'Luminous Green Flora & Suede Iris',
      great_for: 'Daytime elegance, boardroom presence, effortless signature wear',
      the_feel: 'Structured, confident, crisp, and velvety',
      scent_profile: 'Chypre Floral • Radiant Green • Soft Leather',
      top_notes: 'Bergamot, Neroli, Hyacinth',
      heart_notes: 'Iris, Narcissus, Ylang-Ylang',
      base_notes: 'Leather, Sandalwood, Vetiver',
      longevity: '8 to 10 Hours',
      sillage: 'Moderate & Elegant',
      concentration: '20% Eau de Parfum',
      smells_like: 'Fresh green leaves and morning rain moving into sophisticated powdery leather.',
      who_its_for: 'Independent spirits who exude modern grace.',
      how_it_evolves: 'Crisp bergamot and hyacinth open up before settling into sandalwood.'
    }
  }
];

const INITIAL_DISCOUNTS = [
  { code: 'LUNE10', percentage: 10, max_uses: 1000, is_active: true },
  { code: 'WELCOME15', percentage: 15, max_uses: 500, is_active: true },
  { code: 'HAUTE20', percentage: 20, max_uses: 100, is_active: true }
];

const INITIAL_LOCATIONS = [
  {
    city: 'Paris',
    country: 'France',
    address: '31 Rue Cambon, 75001 Paris',
    lat: 48.8687,
    lng: 2.3259,
    phone: '+33 1 42 86 28 00',
    hours: 'Mon-Sat: 10:00 AM - 7:00 PM'
  },
  {
    city: 'Grasse',
    country: 'France',
    address: '15 Boulevard du Jeu de Ballon, 06130 Grasse',
    lat: 43.6589,
    lng: 6.9242,
    phone: '+33 4 93 36 01 22',
    hours: 'Tue-Sun: 9:30 AM - 6:30 PM'
  },
  {
    city: 'New York',
    country: 'USA',
    address: '730 5th Ave, New York, NY 10019',
    lat: 40.7624,
    lng: -73.9744,
    phone: '+1 212 535 5500',
    hours: 'Mon-Sat: 10:00 AM - 8:00 PM'
  }
];

async function seed() {
  console.log('🌱 Seeding Supabase database...');

  // Seed Products
  for (const prod of INITIAL_PRODUCTS) {
    const { sizes, scentDetails, ...productData } = prod;
    
    const { error: prodErr } = await supabaseAdmin
      .from('products')
      .upsert(productData);

    if (prodErr) {
      console.error(`Error inserting product ${productData.id}:`, prodErr);
      continue;
    }

    // Insert Sizes
    for (const sizeObj of sizes) {
      await supabaseAdmin.from('product_sizes').upsert({
        product_id: productData.id,
        ...sizeObj
      });
    }

    // Insert Scent Details
    if (scentDetails) {
      await supabaseAdmin.from('product_scent_details').upsert({
        product_id: productData.id,
        ...scentDetails
      });
    }
  }

  // Seed Discounts
  for (const d of INITIAL_DISCOUNTS) {
    await supabaseAdmin.from('discounts').upsert(d, { onConflict: 'code' });
  }

  // Seed Locations
  for (const loc of INITIAL_LOCATIONS) {
    await supabaseAdmin.from('brand_locations').insert(loc);
  }

  console.log('✅ Seeding completed successfully!');
}

seed().catch(console.error);
