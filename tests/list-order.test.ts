import { describe, expect, it } from "vitest";
import { sortListsByCreatedAt } from "@/lib/list-order";

describe("sortListsByCreatedAt", () => {
  it("keeps newer lists on the right by sorting oldest first", () => {
    const lists = [
      { id: "list_new", created_at: "2026-05-17T10:02:00.000Z", updated_at: "2026-05-17T10:02:00.000Z" },
      { id: "list_old", created_at: "2026-05-17T10:00:00.000Z", updated_at: "2026-05-17T10:10:00.000Z" },
      { id: "list_middle", created_at: "2026-05-17T10:01:00.000Z", updated_at: "2026-05-17T10:01:00.000Z" },
    ];

    expect(sortListsByCreatedAt(lists).map((list) => list.id)).toEqual([
      "list_old",
      "list_middle",
      "list_new",
    ]);
  });
});
