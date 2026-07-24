export type AdPlacement = "home" | "login" | "legal";

export type MonetizationEnv = Partial<{
  GOOGLE_ADSENSE_PUBLISHER_ID: string;
  NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT: string;
  NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_HOME: string;
  NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_LOGIN: string;
  NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_LEGAL: string;
}>;

const publisherPattern = /^pub-\d{16}$/;
const clientPattern = /^ca-pub-\d{16}$/;
const slotPattern = /^\d{10}$/;

const placementKeys: Record<AdPlacement, keyof MonetizationEnv> = {
  home: "NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_HOME",
  login: "NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_LOGIN",
  legal: "NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_LEGAL",
};

export function resolveAdSensePublisherId(env: MonetizationEnv) {
  const explicitPublisherId = env.GOOGLE_ADSENSE_PUBLISHER_ID?.trim();
  if (explicitPublisherId && publisherPattern.test(explicitPublisherId)) {
    return explicitPublisherId;
  }

  const client = env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT?.trim();
  if (client && clientPattern.test(client)) {
    return client.replace(/^ca-/, "");
  }

  return null;
}

export function getAdSenseConfig(env: MonetizationEnv, placement: AdPlacement) {
  const client = env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT?.trim();
  const slot = env[placementKeys[placement]]?.trim();
  if (!client || !clientPattern.test(client) || !slot || !slotPattern.test(slot)) {
    return null;
  }

  return { client, slot };
}

export function buildAdsTxt(env: MonetizationEnv) {
  const publisherId = resolveAdSensePublisherId(env);
  return publisherId
    ? `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`
    : "# Google AdSense publisher ID is not configured yet.\n";
}

export function getBuildMonetizationEnv(): MonetizationEnv {
  return {
    GOOGLE_ADSENSE_PUBLISHER_ID: process.env.GOOGLE_ADSENSE_PUBLISHER_ID,
    NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT: process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT,
    NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_HOME: process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_HOME,
    NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_LOGIN: process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_LOGIN,
    NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_LEGAL: process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_LEGAL,
  };
}
