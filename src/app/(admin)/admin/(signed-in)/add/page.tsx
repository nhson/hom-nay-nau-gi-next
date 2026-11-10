import { Suspense } from "react";
import { AddScreen } from "@/components/admin/add-screen";

// The tab comes from the address (?cach=), read in the browser.
export default function AddPage() {
  return (
    <Suspense>
      <AddScreen />
    </Suspense>
  );
}
