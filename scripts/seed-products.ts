/**
 * Seed script: inserts ~60 sample products in 4 categories (15 each).
 * Safe to re-run: clears `products` and re-inserts.
 *
 * NOTE: the original 16 products keep their exact names/prices — the
 * analytics generator's planted pairs reference them by name.
 *
 * Run:  npm run seed
 */
import mongoose from "mongoose";
import { Product } from "../src/models/Product";

const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/shop";

type SeedProduct = {
  name: string;
  description: string;
  category: string;
  price: number; // paise
  currency: string;
  imageUrl: string;
  stock: number;
  isActive: boolean;
};

const IMG = "/images/placeholder.svg";

const PRODUCTS: SeedProduct[] = [
  // ---------- Electronics (15) ----------
  { name: "Wireless Mouse", description: "Compact wireless mouse with USB receiver and 12-month battery.", category: "Electronics", price: 79900, currency: "INR", imageUrl: IMG, stock: 25, isActive: true },
  { name: "Mechanical Keyboard", description: "Tenkeyless mechanical keyboard with tactile switches.", category: "Electronics", price: 349900, currency: "INR", imageUrl: IMG, stock: 15, isActive: true },
  { name: "USB-C Hub", description: "7-in-1 USB-C hub with HDMI, USB-A and SD card slots.", category: "Electronics", price: 249900, currency: "INR", imageUrl: IMG, stock: 30, isActive: true },
  { name: "Bluetooth Headphones", description: "Over-ear Bluetooth headphones with 40h battery life.", category: "Electronics", price: 499900, currency: "INR", imageUrl: IMG, stock: 12, isActive: true },
  { name: "Bluetooth Speaker", description: "Portable waterproof speaker with 20h playtime.", category: "Electronics", price: 299900, currency: "INR", imageUrl: IMG, stock: 20, isActive: true },
  { name: "Smart Watch", description: "Fitness smartwatch with heart-rate and SpO2 tracking.", category: "Electronics", price: 599900, currency: "INR", imageUrl: IMG, stock: 10, isActive: true },
  { name: "Wireless Charger Pad", description: "15W fast wireless charger for phones and earbuds.", category: "Electronics", price: 149900, currency: "INR", imageUrl: IMG, stock: 35, isActive: true },
  { name: "Laptop Sleeve 15in", description: "Padded water-resistant sleeve for 15-inch laptops.", category: "Electronics", price: 129900, currency: "INR", imageUrl: IMG, stock: 40, isActive: true },
  { name: "Webcam 1080p", description: "Full-HD webcam with dual mic for calls and streaming.", category: "Electronics", price: 279900, currency: "INR", imageUrl: IMG, stock: 14, isActive: true },
  { name: "Portable SSD 500GB", description: "USB-C portable SSD, 500GB, up to 1050MB/s reads.", category: "Electronics", price: 549900, currency: "INR", imageUrl: IMG, stock: 9, isActive: true },
  { name: "Gaming Mouse Pad XL", description: "900x400mm desk mat with stitched edges.", category: "Electronics", price: 89900, currency: "INR", imageUrl: IMG, stock: 45, isActive: true },
  { name: "USB-C Cable 2m", description: "Braided 100W USB-C cable, 2 metres.", category: "Electronics", price: 49900, currency: "INR", imageUrl: IMG, stock: 80, isActive: true },
  { name: "Power Bank 20000mAh", description: "20000mAh power bank with 22.5W fast charging.", category: "Electronics", price: 219900, currency: "INR", imageUrl: IMG, stock: 28, isActive: true },
  { name: "Earbuds Pro", description: "True-wireless earbuds with active noise cancellation.", category: "Electronics", price: 349900, currency: "INR", imageUrl: IMG, stock: 18, isActive: true },
  { name: "Monitor Light Bar", description: "USB monitor light bar with auto-dimming sensor.", category: "Electronics", price: 329900, currency: "INR", imageUrl: IMG, stock: 11, isActive: true },
  // ---------- Books (15) ----------
  { name: "The Pragmatic Programmer", description: "Classic guide to pragmatic software craftsmanship.", category: "Books", price: 129900, currency: "INR", imageUrl: IMG, stock: 40, isActive: true },
  { name: "Clean Code", description: "A handbook of agile software craftsmanship by Robert C. Martin.", category: "Books", price: 119900, currency: "INR", imageUrl: IMG, stock: 35, isActive: true },
  { name: "Atomic Habits", description: "Tiny changes, remarkable results — habit building guide.", category: "Books", price: 89900, currency: "INR", imageUrl: IMG, stock: 50, isActive: true },
  { name: "Indian Cookbook", description: "100 regional Indian recipes with step-by-step photos.", category: "Books", price: 69900, currency: "INR", imageUrl: IMG, stock: 20, isActive: true },
  { name: "Design Patterns", description: "Elements of reusable object-oriented software (GoF).", category: "Books", price: 139900, currency: "INR", imageUrl: IMG, stock: 22, isActive: true },
  { name: "Refactoring", description: "Improving the design of existing code, second edition.", category: "Books", price: 129900, currency: "INR", imageUrl: IMG, stock: 18, isActive: true },
  { name: "Deep Work", description: "Rules for focused success in a distracted world.", category: "Books", price: 99900, currency: "INR", imageUrl: IMG, stock: 30, isActive: true },
  { name: "The Alchemist", description: "Paulo Coelho's fable about following your dream.", category: "Books", price: 59900, currency: "INR", imageUrl: IMG, stock: 45, isActive: true },
  { name: "Malgudi Days", description: "R.K. Narayan's beloved short stories from Malgudi.", category: "Books", price: 49900, currency: "INR", imageUrl: IMG, stock: 38, isActive: true },
  { name: "A Brief History of Time", description: "Stephen Hawking on the universe, from Big Bang to black holes.", category: "Books", price: 79900, currency: "INR", imageUrl: IMG, stock: 25, isActive: true },
  { name: "Sapiens", description: "A brief history of humankind by Yuval Noah Harari.", category: "Books", price: 109900, currency: "INR", imageUrl: IMG, stock: 28, isActive: true },
  { name: "The Lean Startup", description: "How constant innovation creates radically successful businesses.", category: "Books", price: 99900, currency: "INR", imageUrl: IMG, stock: 20, isActive: true },
  { name: "Ikigai", description: "The Japanese secret to a long and happy life.", category: "Books", price: 69900, currency: "INR", imageUrl: IMG, stock: 42, isActive: true },
  { name: "Wings of Fire", description: "Autobiography of A.P.J. Abdul Kalam.", category: "Books", price: 54900, currency: "INR", imageUrl: IMG, stock: 33, isActive: true },
  { name: "Gitanjali", description: "Tagore's Nobel-winning collection of poems.", category: "Books", price: 44900, currency: "INR", imageUrl: IMG, stock: 26, isActive: true },
  // ---------- Home (15) ----------
  { name: "Ceramic Coffee Mug (Set of 2)", description: "Hand-glazed 350ml ceramic mugs, dishwasher safe.", category: "Home", price: 59900, currency: "INR", imageUrl: IMG, stock: 60, isActive: true },
  { name: "Cotton Bedsheet (Queen)", description: "100% cotton queen bedsheet with 2 pillow covers.", category: "Home", price: 149900, currency: "INR", imageUrl: IMG, stock: 22, isActive: true },
  { name: "LED Desk Lamp", description: "Dimmable LED desk lamp with 3 color temperatures.", category: "Home", price: 179900, currency: "INR", imageUrl: IMG, stock: 18, isActive: true },
  { name: "Stainless Steel Bottle 1L", description: "Vacuum-insulated 1L steel bottle, keeps drinks hot/cold 24h.", category: "Home", price: 99900, currency: "INR", imageUrl: IMG, stock: 45, isActive: true },
  { name: "Scented Candle Set", description: "Set of 3 soy scented candles: vanilla, sandalwood, lemongrass.", category: "Home", price: 79900, currency: "INR", imageUrl: IMG, stock: 36, isActive: true },
  { name: "Wall Clock Minimal", description: "12-inch silent-sweep minimal wall clock.", category: "Home", price: 119900, currency: "INR", imageUrl: IMG, stock: 24, isActive: true },
  { name: "Throw Pillow Covers 5pc", description: "Set of 5 cotton cushion covers, 16x16 inch.", category: "Home", price: 99900, currency: "INR", imageUrl: IMG, stock: 30, isActive: true },
  { name: "Ceramic Dinner Plates 6pc", description: "Set of 6 stoneware dinner plates, 10 inch.", category: "Home", price: 199900, currency: "INR", imageUrl: IMG, stock: 16, isActive: true },
  { name: "Indoor Plant Monstera", description: "Live monstera deliciosa in a 6-inch ceramic pot.", category: "Home", price: 89900, currency: "INR", imageUrl: IMG, stock: 20, isActive: true },
  { name: "Table Lamp Brass", description: "Brass-finish bedside table lamp with linen shade.", category: "Home", price: 229900, currency: "INR", imageUrl: IMG, stock: 12, isActive: true },
  { name: "Storage Baskets 3pc", description: "Set of 3 woven seagrass storage baskets.", category: "Home", price: 129900, currency: "INR", imageUrl: IMG, stock: 26, isActive: true },
  { name: "Curtain Set Beige", description: "Pair of beige blackout curtains, 7ft, with rings.", category: "Home", price: 179900, currency: "INR", imageUrl: IMG, stock: 15, isActive: true },
  { name: "Non-stick Pan 28cm", description: "28cm induction-friendly non-stick frying pan.", category: "Home", price: 159900, currency: "INR", imageUrl: IMG, stock: 21, isActive: true },
  { name: "Tea Kettle 1.7L", description: "1.7L electric kettle with auto shut-off.", category: "Home", price: 189900, currency: "INR", imageUrl: IMG, stock: 17, isActive: true },
  { name: "Doormat Coir", description: "Natural coir doormat, anti-skid backing.", category: "Home", price: 49900, currency: "INR", imageUrl: IMG, stock: 55, isActive: true },
  // ---------- Fashion (15) ----------
  { name: "Cotton T-Shirt", description: "Plain breathable cotton t-shirt, unisex fit.", category: "Fashion", price: 49900, currency: "INR", imageUrl: IMG, stock: 100, isActive: true },
  { name: "Denim Jacket", description: "Classic mid-wash denim jacket with button closure.", category: "Fashion", price: 299900, currency: "INR", imageUrl: IMG, stock: 10, isActive: true },
  { name: "Canvas Sneakers", description: "Lightweight canvas sneakers for everyday wear.", category: "Fashion", price: 199900, currency: "INR", imageUrl: IMG, stock: 28, isActive: true },
  { name: "Wool Scarf", description: "Soft wool-blend winter scarf, 180cm.", category: "Fashion", price: 89900, currency: "INR", imageUrl: IMG, stock: 0, isActive: true }, // deliberately out of stock
  { name: "Linen Shirt", description: "Breathable pure-linen casual shirt.", category: "Fashion", price: 149900, currency: "INR", imageUrl: IMG, stock: 32, isActive: true },
  { name: "Chinos Beige", description: "Slim-fit stretch chinos in beige.", category: "Fashion", price: 179900, currency: "INR", imageUrl: IMG, stock: 25, isActive: true },
  { name: "Running Shoes", description: "Cushioned running shoes with breathable mesh.", category: "Fashion", price: 349900, currency: "INR", imageUrl: IMG, stock: 14, isActive: true },
  { name: "Leather Wallet", description: "Full-grain leather bifold wallet with RFID shield.", category: "Fashion", price: 129900, currency: "INR", imageUrl: IMG, stock: 40, isActive: true },
  { name: "Sunglasses Aviator", description: "Polarized aviator sunglasses with UV400 lenses.", category: "Fashion", price: 199900, currency: "INR", imageUrl: IMG, stock: 19, isActive: true },
  { name: "Backpack 25L", description: "25L water-repellent backpack with laptop sleeve.", category: "Fashion", price: 249900, currency: "INR", imageUrl: IMG, stock: 23, isActive: true },
  { name: "Kurta Cotton", description: "Straight-cut cotton kurta for festive wear.", category: "Fashion", price: 169900, currency: "INR", imageUrl: IMG, stock: 27, isActive: true },
  { name: "Sneaker Socks 6pk", description: "Pack of 6 cushioned ankle socks.", category: "Fashion", price: 39900, currency: "INR", imageUrl: IMG, stock: 90, isActive: true },
  { name: "Belt Leather Reversible", description: "Reversible black/brown genuine-leather belt.", category: "Fashion", price: 99900, currency: "INR", imageUrl: IMG, stock: 34, isActive: true },
  { name: "Hoodie Fleece", description: "Heavyweight fleece hoodie with kangaroo pocket.", category: "Fashion", price: 219900, currency: "INR", imageUrl: IMG, stock: 21, isActive: true },
  { name: "Watch Minimal Steel", description: "Minimalist steel-strap quartz watch.", category: "Fashion", price: 449900, currency: "INR", imageUrl: IMG, stock: 8, isActive: true },
];

async function main() {
  await mongoose.connect(MONGODB_URI);
  await Product.deleteMany({});
  await Product.insertMany(PRODUCTS);
  // Ensure indexes (text index for search) exist after a fresh insert.
  await Product.syncIndexes();
  const count = await Product.countDocuments();
  console.log(`Seeded ${count} products.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
