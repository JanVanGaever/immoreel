import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/constants";

/** De marketingsite staat los; / stuurt door naar de app. */
export default function Home() {
  redirect(ROUTES.dashboard);
}
