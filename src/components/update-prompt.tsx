"use client";

import { useSerwist } from "@serwist/turbopack/react";
import { useEffect } from "react";
import { toast } from "sonner";

const TOAST_ID = "app-update";

/**
 * Tells the user when a new version is installed and waiting. Accepting activates it and reloads;
 * everything personal lives in IndexedDB, so nothing is lost.
 */
export function UpdatePrompt() {
  const { serwist } = useSerwist();

  useEffect(() => {
    if (!serwist) return;
    const onWaiting = () =>
      toast("Có phiên bản mới của ứng dụng", {
        id: TOAST_ID,
        duration: Infinity,
        action: { label: "Cập nhật", onClick: () => serwist.messageSkipWaiting() },
      });
    // Once the new worker takes control, reload so the page matches it.
    const onControlling = () => window.location.reload();
    serwist.addEventListener("waiting", onWaiting);
    serwist.addEventListener("controlling", onControlling);
    return () => {
      serwist.removeEventListener("waiting", onWaiting);
      serwist.removeEventListener("controlling", onControlling);
    };
  }, [serwist]);

  return null;
}
