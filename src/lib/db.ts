import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI. Copy .env.local.example to .env.local.");
}

// Cache the connection across hot reloads in dev.
// Next.js dev re-runs modules on every save; without this we'd open a new
// connection per save and exhaust MongoDB connections.
type Cached = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  // `var` here extends NodeJS global scope for connection caching.
  var _mongooseCache: Cached | undefined;
}

const cached: Cached = globalThis._mongooseCache ?? { conn: null, promise: null };
globalThis._mongooseCache = cached;

export async function connectDb(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI as string).then((m) => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
