import { NextResponse } from "next/server";
import { getAdSenseConfig, type AdPlacement } from "@/lib/monetization";
import { getRuntimeMonetizationEnv } from "@/lib/monetization-runtime";

const placements = new Set<AdPlacement>(["home", "login", "legal"]);

export async function GET(request: Request) {
  const placement = new URL(request.url).searchParams.get("placement");

  if (!placement || !placements.has(placement as AdPlacement)) {
    return NextResponse.json({ error: "Invalid placement" }, { status: 400 });
  }

  const config = getAdSenseConfig(
    await getRuntimeMonetizationEnv(),
    placement as AdPlacement,
  );

  if (!config) {
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }

  return NextResponse.json(config, {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" },
  });
}
