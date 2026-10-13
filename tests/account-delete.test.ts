import { beforeEach, describe, expect, it, vi } from "vitest";

const { getServerSession } = vi.hoisted(() => ({ getServerSession: vi.fn() }));
const { userFindFirst, userDelete } = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  userDelete: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/queries", () => ({ refreshUserCache: vi.fn() }));
vi.mock("@/lib/revalidate-tabs", () => ({ revalidateTabs: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: { user: { findFirst: userFindFirst, delete: userDelete } },
}));

import { deleteAccount } from "@/app/account/actions";

describe("deleteAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { id: "user-a" } });
  });

  it("deletes only the signed-in user's own row (the rest cascades)", async () => {
    userFindFirst.mockResolvedValue({ id: "user-a" });
    userDelete.mockResolvedValue({ id: "user-a" });
    const result = await deleteAccount();
    expect(result).toEqual({ success: true });
    expect(userDelete).toHaveBeenCalledWith({ where: { id: "user-a" } });
  });

  it("rejects unauthenticated callers", async () => {
    getServerSession.mockResolvedValue(null);
    await expect(deleteAccount()).rejects.toThrow("Not signed in");
    expect(userDelete).not.toHaveBeenCalled();
  });

  it("reports a missing account without deleting", async () => {
    userFindFirst.mockResolvedValue(null);
    const result = await deleteAccount();
    expect(result).toEqual({ error: "Account not found." });
    expect(userDelete).not.toHaveBeenCalled();
  });
});
