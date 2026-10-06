/**
 * Seed script: inserts ~16 sample products in 4 categories.
 * Safe to re-run: clears `products` and re-inserts.
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

const PRODUCTS: SeedProduct[] = [
  // Electronics
  {
    name: "Wireless Mouse",
    description: "Compact wireless mouse with USB receiver and 12-month battery.",
    category: "Electronics",
    price: 79900,
    currency: "INR",
    imageUrl: "/images/placeholder.svg",
    stock: 25,
    isActive: true,
  },
  {
    name: "Mechanical Keyboard",
    description: "Tenkeyless mechanical keyboard with tactile switches.",
    category: "Electronics",
    price: 349900,
    currency: "INR",
    imageUrl: "/images/placeholder.svg",
    stock: 15,
    isActive: true,
  },
  {
    name: "USB-C Hub",
    description: "7-in-1 USB-C hub with HDMI, USB-A and SD card slots.",
    category: "Electronics",
    price: 249900,
    currency: "INR",
    imageUrl: "/images/placeholder.svg",
    stock: 30,
    isActive: true,
  },
  {
    name: "Bluetooth Headphones",
    description: "Over-ear Bluetooth headphones with 40h battery life.",
    category: "Electronics",
    price: 499900,
    currency: "INR",
    imageUrl: "/images/placeholder.svg",
    stock: 12,
    isActive: true,
  },
  // Books
  {
    name: "The Pragmatic Programmer",
    description: "Classic guide to pragmatic software craftsmanship.",
    category: "Books",
    price: 129900,
    currency: "INR",
    imageUrl: "/images/placeholder.svg",
    stock: 40,
    isActive: true,
  },
  {
    name: "Clean Code",
    description: "A handbook of agile software craftsmanship by Robert C. Martin.",
    category: "Books",
    price: 119900,
    currency: "INR",
    imageUrl: "/images/placeholder.svg",
    stock: 35,
    isActive: true,
  },
  {
    name: "Atomic Habits",
    description: "Tiny changes, remarkable results — habit building guide.",
    category: "Books",
    price: 89900,
    currency: "INR",
    imageUrl: "/images/placeholder.svg",
    stock: 50,
    isActive: true,
  },
  {
    name: "Indian Cookbook",
    description: "100 regional Indian recipes with step-by-step photos.",
    category: "Books",
    price: 69900,
    currency: "INR",
    imageUrl: "/images/placeholder.svg",
    stock: 20,
    isActive: true,
  },
  // Home
  {
    name: "Ceramic Coffee Mug (Set of 2)",
    description: "Hand-glazed 350ml ceramic mugs, dishwasher safe.",
    category: "Home",
    price: 59900,
    currency: "INR",
    imageUrl: "/images/placeholder.svg",
    stock: 60,
    isActive: true,
  },
  {
    name: "Cotton Bedsheet (Queen)",
    description: "100% cotton queen bedsheet with 2 pillow covers.",
    category: "Home",
    price: 149900,
    currency: "INR",
    imageUrl: "/images/placeholder.svg",
    stock: 22,
    isActive: true,
  },
  {
    name: "LED Desk Lamp",
    description: "Dimmable LED desk lamp with 3 color temperatures.",
    category: "Home",
    price: 179900,
    currency: "INR",
    imageUrl: "/images/placeholder.svg",
    stock: 18,
    isActive: true,
  },
  {
    name: "Stainless Steel Bottle 1L",
    description: "Vacuum-insulated 1L steel bottle, keeps drinks hot/cold 24h.",
    category: "Home",
    price: 99900,
    currency: "INR",
    imageUrl: "/images/placeholder.svg",
    stock: 45,
    isActive: true,
  },
  // Fashion
  {
    name: "Cotton T-Shirt",
    description: "Plain breathable cotton t-shirt, unisex fit.",
    category: "Fashion",
    price: 49900,
    currency: "INR",
    imageUrl: "/images/placeholder.svg",
    stock: 100,
    isActive: true,
  },
  {
    name: "Denim Jacket",
    description: "Classic mid-wash denim jacket with button closure.",
    category: "Fashion",
    price: 299900,
    currency: "INR",
    imageUrl: "/images/placeholder.svg",
    stock: 10,
    isActive: true,
  },
  {
    name: "Canvas Sneakers",
    description: "Lightweight canvas sneakers for everyday wear.",
    category: "Fashion",
    price: 199900,
    currency: "INR",
    imageUrl: "/images/placeholder.svg",
    stock: 28,
    isActive: true,
  },
  {
    name: "Wool Scarf",
    description: "Soft wool-blend winter scarf, 180cm.",
    category: "Fashion",
    price: 89900,
    currency: "INR",
    imageUrl: "/images/placeholder.svg",
    stock: 0, // deliberately out of stock to exercise the UI state
    isActive: true,
  },
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
