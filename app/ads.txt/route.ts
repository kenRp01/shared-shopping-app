import { buildAdsTxt } from "@/lib/monetization";
import { getRuntimeMonetizationEnv } from "@/lib/monetization-runtime";

export async function GET() {
  return new Response(buildAdsTxt(await getRuntimeMonetizationEnv()), {
    headers: {
      "cache-control": "public, max-age=300, s-maxage=3600",
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
