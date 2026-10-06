import { describe, expect, it } from "vitest";
import { cartTotal, formatMoney } from "./money";
import { cartItemSchema, cartUpdateSchema, loginSchema, signupSchema } from "./validators";

describe("money helpers", () => {
  it("cartTotal sums unitPrice * quantity", () => {
    expect(cartTotal([{ unitPrice: 79900, quantity: 2 }])).toBe(159800);
    expect(
      cartTotal([
        { unitPrice: 100, quantity: 1 },
        { unitPrice: 250, quantity: 3 },
      ])
    ).toBe(850);
  });

  it("cartTotal of empty cart is 0", () => {
    expect(cartTotal([])).toBe(0);
  });

  it("formatMoney formats paise as rupees", () => {
    const s = formatMoney(79900, "INR");
    expect(typeof s).toBe("string");
    expect(s).toContain("799");
  });
});

describe("validators (NoSQL injection + password rules)", () => {
  it("rejects non-string email (NoSQL injection attempt)", () => {
    const evil = { email: { $ne: null }, password: "password123" };
    expect(loginSchema.safeParse(evil).success).toBe(false);
    expect(signupSchema.safeParse({ name: "A", ...evil }).success).toBe(false);
  });

  it("rejects short passwords", () => {
    expect(
      signupSchema.safeParse({ name: "A", email: "a@example.com", password: "short" }).success
    ).toBe(false);
  });

  it("accepts valid signup/login bodies", () => {
    expect(
      signupSchema.safeParse({ name: "Asha", email: "Asha@Example.com", password: "password123" })
        .success
    ).toBe(true);
    expect(
      loginSchema.safeParse({ email: "a@example.com", password: "password123" }).success
    ).toBe(true);
  });

  it("cart schemas enforce quantity bounds", () => {
    expect(cartItemSchema.safeParse({ productId: "abc", quantity: 0 }).success).toBe(false);
    expect(cartItemSchema.safeParse({ productId: "abc", quantity: 2 }).success).toBe(true);
    // 0 is allowed on update (means remove), 100 is not
    expect(cartUpdateSchema.safeParse({ productId: "abc", quantity: 0 }).success).toBe(true);
    expect(cartUpdateSchema.safeParse({ productId: "abc", quantity: 100 }).success).toBe(false);
  });
});
