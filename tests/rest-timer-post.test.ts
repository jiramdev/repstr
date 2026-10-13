import { beforeEach, describe, expect, it, vi } from "vitest";

const { getServerSession } = vi.hoisted(() => ({ getServerSession: vi.fn() }));
const { publishJSON, messagesDelete } = vi.hoisted(() => ({
  publishJSON: vi.fn(),
  messagesDelete: vi.fn(),
}));

const {
  pushFindUnique,
  pushCreate,
  workoutLogFindFirst,
  restUpsert,
  restUpdateMany,
  prismaTransaction,
} = vi.hoisted(() => ({
  pushFindUnique: vi.fn(),
  pushCreate: vi.fn(),
  workoutLogFindFirst: vi.fn(),
  restUpsert: vi.fn(),
  restUpdateMany: vi.fn(),
  prismaTransaction: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@upstash/qstash", () => ({
  Client: vi.fn(() => ({ publishJSON, messages: { delete: messagesDelete } })),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    pushSubscription: {
      findUnique: pushFindUnique,
      create: pushCreate,
      update: vi.fn(),
      delete: vi.fn(),
    },
    workoutLog: { findFirst: workoutLogFindFirst },
    restTimer: { upsert: restUpsert, updateMany: restUpdateMany },
    $transaction: prismaTransaction,
  },
}));

import { POST } from "@/app/api/rest-timer/route";

const SUBSCRIPTION = {
  endpoint: "https://fcm.googleapis.com/fcm/send/test-device-1",
  keys: { p256dh: "p256dh-key", auth: "auth-key" },
};

function post(body: unknown) {
  return POST(
    new Request("https://workout-tracker.example/api/rest-timer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("POST /api/rest-timer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { id: "user-a" } });
    process.env.QSTASH_TOKEN = "qstash-token";
    process.env.APP_URL = "https://workout-tracker.example";
    pushFindUnique.mockResolvedValue(null);
    pushCreate.mockResolvedValue({ id: "sub-1" });
    workoutLogFindFirst.mockResolvedValue({ id: "session-1" });
    prismaTransaction.mockImplementation(async (ops: unknown) => ops);
    restUpdateMany.mockResolvedValue({ count: 0 });
    publishJSON.mockResolvedValue({ messageId: "msg-1" });
  });

  it("creates the new timer pending with fireAt", async () => {
    const response = await post({
      subscription: SUBSCRIPTION,
      delaySeconds: 90,
      exerciseName: "Squat",
      planId: null,
      token: "token-new",
      workoutLogId: "session-1",
    });

    expect(response.status).toBe(200);
    expect(restUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_token: { userId: "user-a", token: "token-new" } },
      })
    );
    const createData = restUpsert.mock.calls[0][0].create;
    expect(createData.status).toBe("pending");
    expect(createData.workoutLogId).toBe("session-1");
    expect(createData.fireAt instanceof Date).toBe(true);
  });

  it("cancels only the session's other pending timers in the same transaction", async () => {
    const response = await post({
      subscription: SUBSCRIPTION,
      delaySeconds: 90,
      exerciseName: "Squat",
      planId: null,
      token: "token-new",
      workoutLogId: "session-1",
    });

    expect(response.status).toBe(200);
    expect(prismaTransaction).toHaveBeenCalledTimes(1);
    expect(prismaTransaction.mock.calls[0][0]).toHaveLength(2);
    expect(restUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-a",
          workoutLogId: "session-1",
          status: "pending",
          NOT: { token: "token-new" },
        }),
        data: { status: "cancelled" },
      })
    );
  });
});
