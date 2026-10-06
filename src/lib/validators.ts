import { z } from "zod";

// NOTE: email/password must be z.string() (never passthrough) so a malicious
// body like { email: { $ne: null } } is rejected — this blocks NoSQL injection.
export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().min(1, "Email is required").email("Invalid email").max(254),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Invalid email").max(254),
  password: z.string().min(1, "Password is required").max(128),
});

export const cartItemSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  quantity: z.number().int().min(1).max(99),
});

export const cartUpdateSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  quantity: z.number().int().min(0).max(99),
});

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  address: z
    .object({
      line1: z.string().max(200).optional().default(""),
      city: z.string().max(100).optional().default(""),
      state: z.string().max(100).optional().default(""),
      postalCode: z.string().max(20).optional().default(""),
      country: z.string().max(100).optional().default(""),
    })
    .optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(128),
});
