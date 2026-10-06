import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

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

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    // Always stored lowercase (see signup route). Unique index below.
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["customer", "admin"], default: "customer", required: true },
    address: { type: AddressSchema, default: () => ({}) },
  },
  { timestamps: true }
);

// Unique on lowercase email.
UserSchema.index({ email: 1 }, { unique: true });

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: mongoose.Types.ObjectId };

export const User = models.User ?? model("User", UserSchema);
