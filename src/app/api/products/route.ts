import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Product } from "@/models/Product";

const PAGE_SIZE = 12;
const MAX_LIMIT = 48;

function toDto(p: {
  _id: unknown;
  name: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  imageUrl: string;
  stock: number;
  isActive: boolean;
}) {
  return {
    id: String(p._id),
    name: p.name,
    description: p.description,
    category: p.category,
    price: p.price,
    currency: p.currency,
    imageUrl: p.imageUrl,
    stock: p.stock,
    isActive: p.isActive,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") ?? "").trim();
  const category = (searchParams.get("category") ?? "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const sort = (searchParams.get("sort") ?? "").trim();
  // Optional override so the storefront landing can fetch everything at once.
  const limitParam = parseInt(searchParams.get("limit") ?? "", 10);
  const pageSize = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), MAX_LIMIT)
    : PAGE_SIZE;

  await connectDb();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = { isActive: true };
  if (category) filter.category = category;
  if (search) filter.$text = { $search: search };

  const total = await Product.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let order: Record<string, any>;
  if (sort === "price-asc") order = { price: 1 };
  else if (sort === "price-desc") order = { price: -1 };
  else if (search) order = { score: { $meta: "textScore" } };
  else order = { createdAt: -1 };

  const docs = await Product.find(filter)
    .sort(order)
    .skip((safePage - 1) * pageSize)
    .limit(pageSize)
    .lean();

  const categories: string[] = await Product.distinct("category", { isActive: true });

  return NextResponse.json({
    products: docs.map((d) =>
      toDto(
        d as {
          _id: unknown;
          name: string;
          description: string;
          category: string;
          price: number;
          currency: string;
          imageUrl: string;
          stock: number;
          isActive: boolean;
        }
      )
    ),
    page: safePage,
    totalPages,
    total,
    categories: categories.sort(),
  });
}
