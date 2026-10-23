import { notFound } from "next/navigation";

// Any address that matches no page lands here, so it gets the translated
// "page not found" (src/app/[locale]/not-found.tsx) instead of Next's default.
export default function CatchAll() {
  notFound();
}
