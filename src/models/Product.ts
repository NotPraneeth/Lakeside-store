import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

const ProductSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 2000 },
    category: { type: String, required: true, trim: true, maxlength: 100 },
    // Integer in smallest currency unit (paise/cents). Never floats.
    price: { type: Number, required: true, min: 0, validate: Number.isInteger },
    currency: { type: String, default: "INR", maxlength: 3 },
    imageUrl: { type: String, default: "" },
    stock: { type: Number, required: true, min: 0, validate: Number.isInteger },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ProductSchema.index({ category: 1 });
// Text search for catalog search box.
ProductSchema.index({ name: "text", description: "text" });

export type ProductDoc = InferSchemaType<typeof ProductSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Product = models.Product ?? model("Product", ProductSchema);
