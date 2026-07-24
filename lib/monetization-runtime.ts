import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getBuildMonetizationEnv, type MonetizationEnv } from "@/lib/monetization";

export async function getRuntimeMonetizationEnv(): Promise<MonetizationEnv> {
  const buildEnv = getBuildMonetizationEnv();

  try {
    const { env } = await getCloudflareContext({ async: true });
    const runtimeEnv = env as unknown as MonetizationEnv;
    return {
      ...buildEnv,
      ...runtimeEnv,
    };
  } catch {
    return buildEnv;
  }
}
