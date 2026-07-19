import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const adsTxtPath = join(rootDir, "public", "ads.txt");
const publisherId =
  process.env.GOOGLE_ADSENSE_PUBLISHER_ID ??
  process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT?.replace(/^ca-/, "");

const body = publisherId
  ? `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`
  : "# Google AdSense publisher ID is not configured yet.\n";

mkdirSync(dirname(adsTxtPath), { recursive: true });
writeFileSync(adsTxtPath, body);
