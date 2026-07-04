import { describe, expect, it, vi } from "vitest";
import { runReminderCron } from "@/lib/cron-worker";

describe("runReminderCron", () => {
  it("calls the reminder endpoint with the cron secret", async () => {
    const fetchReminder = vi.fn(async (_request: Request) => Response.json({ ok: true, sent: 1 }));

    const result = await runReminderCron(fetchReminder, "test-secret");

    expect(result).toEqual({ ok: true, sent: 1 });
    const request = fetchReminder.mock.calls[0][0];
    expect(new URL(request.url).pathname).toBe("/api/reminders/digest");
    expect(request.method).toBe("GET");
    expect(request.headers.get("authorization")).toBe("Bearer test-secret");
  });

  it("fails before making a request when the secret is missing", async () => {
    const fetchReminder = vi.fn();

    await expect(runReminderCron(fetchReminder, undefined)).rejects.toThrow("CRON_SECRET");
    expect(fetchReminder).not.toHaveBeenCalled();
  });

  it("fails the scheduled event when the reminder endpoint fails", async () => {
    const fetchReminder = vi.fn(async (_request: Request) => new Response("failed", { status: 500 }));

    await expect(runReminderCron(fetchReminder, "test-secret")).rejects.toThrow("500");
  });
});
