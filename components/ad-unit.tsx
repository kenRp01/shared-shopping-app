"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdUnitProps = {
  client: string;
  slot: string;
};

export function AdUnit({ client, slot }: AdUnitProps) {
  useEffect(() => {
    try {
      window.adsbygoogle = window.adsbygoogle ?? [];
      window.adsbygoogle.push({});
    } catch {
      // Ad blockers and local preview environments can reject initialization.
    }
  }, [client, slot]);

  return (
    <ins
      className="adsbygoogle"
      data-ad-client={client}
      data-ad-format="auto"
      data-ad-slot={slot}
      data-full-width-responsive="true"
      style={{ display: "block" }}
    />
  );
}
