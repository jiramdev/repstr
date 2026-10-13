import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
  updateTag: vi.fn(),
}));

import { finishedSessionCountWhere } from "@/lib/queries";

describe("session counts", () => {
  it("counts only finished sessions", () => {
    const start = new Date("2026-10-01T00:00:00.000Z");
    expect(finishedSessionCountWhere("user-a", start)).toEqual({
      userId: "user-a",
      status: "finished",
      completedAt: { gte: start },
    });
  });

  it("abandoning a workout keeps it out of the finished count", () => {
    // Abandoned sessions carry status "abandoned" (see workout session
    // tests), which never matches the finished-only count filter above.
    const where = finishedSessionCountWhere("user-a", new Date());
    expect(where.status).toBe("finished");
    expect(where.status).not.toBe("abandoned");
  });
});
