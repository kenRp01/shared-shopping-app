"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdSlotProps = {
  slot?: string;
  label?: string;
};

const adsenseClient = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT;

export function AdSlot({ slot, label = "広告" }: AdSlotProps) {
  const enabled = Boolean(adsenseClient?.startsWith("ca-pub-") && slot);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    try {
      window.adsbygoogle = window.adsbygoogle ?? [];
      window.adsbygoogle.push({});
    } catch {
      // Ad blockers or unsupported preview environments can reject this call.
    }
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <aside className="ad-slot" aria-label={label}>
      <ins
        className="adsbygoogle"
        data-ad-client={adsenseClient}
        data-ad-format="auto"
        data-ad-slot={slot}
        data-full-width-responsive="true"
        style={{ display: "block" }}
      />
    </aside>
  );
}
