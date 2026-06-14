type HeartbeatQuery = {
  select: (
    columns: string,
    options: { count: "exact"; head: true },
  ) => PromiseLike<{ count: number | null; error: { message: string } | null }>;
};

export type HeartbeatSupabaseClient = {
  from: (table: "profiles") => HeartbeatQuery;
};

export async function runSupabaseHeartbeat(admin: HeartbeatSupabaseClient) {
  const startedAt = Date.now();
  const { count, error } = await admin.from("profiles").select("id", {
    count: "exact",
    head: true,
  });

  if (error) {
    return {
      ok: false,
      error: error.message,
      checkedTable: "profiles",
      durationMs: Date.now() - startedAt,
    };
  }

  return {
    ok: true,
    checkedTable: "profiles",
    profileCount: count ?? 0,
    durationMs: Date.now() - startedAt,
  };
}
