import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

// Behavioral events (Stage 2 funnel + Stage 3 recommenders). Purchases are
// DERIVED from `orders` — never logged here, so nothing can double-count.
// Guests are tracked by sessionId; logged-in users also carry userId.
const EventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    sessionId: { type: String, required: true, trim: true, maxlength: 64 },
    type: {
      type: String,
      required: true,
      enum: ["product_view", "add_to_cart", "remove_from_cart", "search", "category_filter"],
    },
    productId: { type: Schema.Types.ObjectId, ref: "Product", default: null },
    // snapshots so analytics never needs joins
    category: { type: String, default: null, maxlength: 100 },
    // NOTE: custom validators must accept null — Mongoose runs them even on
    // null/defaulted values (Number.isInteger(null) is false and would reject
    // every beacon that omits an optional number).
    unitPrice: {
      type: Number,
      default: null,
      min: 0,
      validate: { validator: (v: unknown) => v == null || Number.isInteger(v) },
    },
    quantity: {
      type: Number,
      default: null,
      min: 1,
      validate: { validator: (v: unknown) => v == null || Number.isInteger(v) },
    },
    searchTerm: { type: String, default: null, trim: true, maxlength: 200 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

EventSchema.index({ productId: 1, createdAt: -1 });
EventSchema.index({ userId: 1, createdAt: -1 });
EventSchema.index({ sessionId: 1, createdAt: -1 });
EventSchema.index({ type: 1, createdAt: -1 });
// Views are high-volume: auto-expire old docs so the collection can't grow
// forever. 40 months comfortably covers multi-year analytics history;
// NOTE: lowering this below the synthetic data span (~30 months) silently
// deletes old events via Mongo's TTL monitor (learned the hard way).
EventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 40 * 30 * 24 * 3600 });

export type EventDoc = InferSchemaType<typeof EventSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ShopEvent = models.ShopEvent ?? model("ShopEvent", EventSchema, "events");
