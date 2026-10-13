import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
const { compare } = vi.hoisted(() => ({ compare: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  default: { user: { findUnique } },
}));

vi.mock("bcryptjs", () => ({
  default: { compare, hash: vi.fn() },
}));

import { authOptions } from "@/lib/auth";
import { peekSignIn } from "@/lib/rate-limit";

function credentials(email: string, password: string) {
  return { email, password };
}

function req(ip: string) {
  return { headers: { "x-forwarded-for": ip } };
}

async function authorize(email: string, password: string, ip: string) {
  const provider = authOptions.providers[0] as unknown as {
    options: { authorize: (credentials: unknown, req: unknown) => Promise<unknown> };
  };
  return provider.options.authorize(credentials(email, password), req(ip));
}

describe("sign-in rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks after 5 failed attempts with the rate message, not a credentials error", async () => {
    const email = `locked-${Math.random()}@example.com`;
    const ip = `203.0.113.${Math.floor(Math.random() * 200) + 10}`;
    findUnique.mockResolvedValue(null);
    compare.mockResolvedValue(false);

    for (let i = 0; i < 5; i++) {
      await expect(authorize(email, "wrong", ip)).rejects.toThrow(
        "No account found with this email address"
      );
    }
    await expect(authorize(email, "wrong", ip)).rejects.toThrow(
      "Too many attempts, try again later."
    );
  });

  it("successful sign-ins use up no attempts", async () => {
    const email = `good-${Math.random()}@example.com`;
    const ip = `198.51.100.${Math.floor(Math.random() * 200) + 10}`;
    findUnique.mockResolvedValue({ id: "user-1", email, name: null, passwordHash: "hash", sessionVersion: 0 });
    compare.mockResolvedValue(true);

    for (let i = 0; i < 10; i++) {
      await expect(authorize(email, "correct", ip)).resolves.toMatchObject({ id: "user-1" });
    }
    expect((await peekSignIn(email, ip)).limited).toBe(false);
  });

  it("wrong passwords consume attempts, then the rate message wins", async () => {
    const email = `pw-${Math.random()}@example.com`;
    const ip = `192.0.2.${Math.floor(Math.random() * 200) + 10}`;
    findUnique.mockResolvedValue({ id: "user-2", email, name: null, passwordHash: "hash", sessionVersion: 0 });
    compare.mockResolvedValue(false);

    for (let i = 0; i < 5; i++) {
      await expect(authorize(email, "wrong", ip)).rejects.toThrow("Invalid password");
    }
    await expect(authorize(email, "wrong", ip)).rejects.toThrow(
      "Too many attempts, try again later."
    );
  });
});
