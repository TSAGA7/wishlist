import { createRoot } from "react-dom/client";
import { WishlistApp } from "@/components/wishlist-app";
import "@/styles.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<WishlistApp />);
}
