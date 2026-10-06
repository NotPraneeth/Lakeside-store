/** Prices are integers in the smallest unit (paise/cents). Format only for display. */
export function formatMoney(amountMinor: number, currency = "INR"): string {
  const divisor = 100;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
    }).format(amountMinor / divisor);
  } catch {
    return `${(amountMinor / divisor).toFixed(2)} ${currency}`;
  }
}

export function cartTotal(items: { unitPrice: number; quantity: number }[]): number {
  return items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
}
