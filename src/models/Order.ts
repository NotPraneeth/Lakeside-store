import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

// Snapshot product details inside each order item (name/category/unitPrice).
// If a product's price or name changes later, old orders still show what the
// customer actually bought. Stage 2 analytics also reads category from here.
const OrderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    unitPrice: { type: Number, required: true, min: 0, validate: Number.isInteger },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
  },
  { _id: false }
);

const AddressSchema = new Schema(
  {
    line1: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    postalCode: { type: String, default: "" },
    country: { type: String, default: "" },
  },
  { _id: false }
);

const OrderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: { type: [OrderItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0, validate: Number.isInteger },
    total: { type: Number, required: true, min: 0, validate: Number.isInteger },
    status: { type: String, enum: ["placed", "cancelled"], default: "placed" },
    shippingAddress: { type: AddressSchema, default: () => ({}) },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Fast "my orders, newest first" + time-based analytics later.
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ createdAt: -1 });

export type OrderDoc = InferSchemaType<typeof OrderSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Order = models.Order ?? model("Order", OrderSchema);
