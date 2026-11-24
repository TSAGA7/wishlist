import { createFileRoute } from "@tanstack/react-router";
import { WishlistApp } from "@/components/wishlist-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <WishlistApp />;
}
