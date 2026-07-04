export type ReminderFetcher = (request: Request) => Promise<Response>;

export async function runReminderCron(fetchReminder: ReminderFetcher, secret?: string) {
  if (!secret) {
    throw new Error("CRON_SECRET が設定されていません。");
  }

  const response = await fetchReminder(
    new Request("https://shareshopi.internal/api/reminders/digest", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secret}`,
        "User-Agent": "ShareShopi-Cloudflare-Cron/1.0",
      },
    }),
  );

  if (!response.ok) {
    throw new Error(`リマインド処理に失敗しました (${response.status})。`);
  }

  return response.json() as Promise<{ ok: boolean; sent?: number; skipped?: number; alreadySent?: number }>;
}
