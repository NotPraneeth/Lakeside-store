/** Fire-and-forget behavioral beacon. Never throws, never blocks UI. */
export function beacon(payload: {
  type: "product_view" | "add_to_cart" | "remove_from_cart" | "search" | "category_filter";
  productId?: string;
  quantity?: number;
  searchTerm?: string;
  category?: string;
}): void {
  try {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* analytics must never break the shop */
  }
}
