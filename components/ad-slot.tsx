"use client";

import { useEffect, useState } from "react";
import { AdUnit } from "@/components/ad-unit";
import { AdsenseScript } from "@/components/adsense-script";
import type { AdPlacement } from "@/lib/monetization";

type AdSlotProps = {
  placement: AdPlacement;
  label?: string;
};

type PublicAdConfig = {
  client: string;
  slot: string;
};

export function AdSlot({ placement, label = "広告" }: AdSlotProps) {
  const [config, setConfig] = useState<PublicAdConfig | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void fetch(`/api/ads/config?placement=${encodeURIComponent(placement)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 204) {
          return null;
        }
        if (!response.ok) {
          throw new Error("広告設定を取得できませんでした");
        }
        return (await response.json()) as PublicAdConfig;
      })
      .then(setConfig)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setConfig(null);
        }
      });

    return () => controller.abort();
  }, [placement]);

  if (!config) {
    return null;
  }

  return (
    <>
      <AdsenseScript client={config.client} />
      <aside className="ad-slot" aria-label={label}>
        <AdUnit client={config.client} slot={config.slot} />
      </aside>
    </>
  );
}
