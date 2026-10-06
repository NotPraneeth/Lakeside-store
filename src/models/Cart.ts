import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

// One cart per user. Stores only IDs + quantities; prices are looked up
// live from products so a stale cart can never show an old price.
const CartItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
  },
  { _id: false }
);

const CartSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: { type: [CartItemSchema], default: [] },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

CartSchema.index({ userId: 1 }, { unique: true });

export type CartDoc = InferSchemaType<typeof CartSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Cart = models.Cart ?? model("Cart", CartSchema);
