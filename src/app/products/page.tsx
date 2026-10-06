import { redirect } from "next/navigation";

// The storefront now lives at `/` — keep old links working.
export default function ProductsRedirect() {
  redirect("/");
}
