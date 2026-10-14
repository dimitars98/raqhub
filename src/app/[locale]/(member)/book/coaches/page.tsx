import { redirect } from "next/navigation";

// Coaches are booked from their own page now (/coaches/<id>).
export default function BookCoachesPage() {
  redirect("/coaches");
}
