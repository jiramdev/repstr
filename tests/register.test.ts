import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const { findUnique, create } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.10" }),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique, create },
  },
}));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn(async () => "hash") },
}));

import { registerUser } from "@/app/actions/auth";

function form(password: string) {
  const data = new FormData();
  data.set("name", "Ada");
  data.set("email", "ada@example.com");
  data.set("password", password);
  return data;
}

describe("registerUser", () => {
  beforeEach(() => {
    findUnique.mockReset();
    create.mockReset();
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue({ id: "user-1" });
  });

  it("rejects a password shorter than 8 characters", async () => {
    const result = await registerUser(form("kort"));
    expect(result).toEqual({ error: "Password must be at least 8 characters." });
    expect(create).not.toHaveBeenCalled();
  });

  it("returns the existing-email error when the insert hits P2002", async () => {
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    );
    const result = await registerUser(form("lang-wachtwoord"));
    expect(result).toEqual({ error: "This email address is already in use." });
  });
});
