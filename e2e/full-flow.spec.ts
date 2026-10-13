import { expect, test, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createECDH, randomBytes } from "node:crypto";
import path from "node:path";

const email = `e2e-${Date.now()}@example.com`;
const password = "e2e-password-long";

let stub: ChildProcess | null = null;

test.beforeAll(async () => {
  stub = spawn(process.execPath, [path.join(__dirname, "qstash-stub.mjs")], {
    env: {
      ...process.env,
      QSTASH_STUB_PORT: "3210",
      QSTASH_STUB_SIGNING_KEY: "e2e-current-key",
    },
    stdio: "ignore",
  });
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch("http://localhost:3210/v2/messages/nope", { method: "DELETE" });
      if (res.ok || res.status === 404) break;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
});

test.afterAll(async () => {
  stub?.kill();
  stub = null;
});

async function restTimerStatus(page: Page): Promise<string | null> {
  const res = await page.context().request.get("/api/debug/rest-timers");
  if (!res.ok()) return null;
  const body = await res.json();
  return (body.timers[0]?.status as string | undefined) ?? null;
}

function fakePushSubscription() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const toUrl = (buf: Buffer) =>
    buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return {
    endpoint: "https://localhost:3220/fake-push/e2e",
    keys: { p256dh: toUrl(ecdh.getPublicKey()), auth: toUrl(randomBytes(16)) },
  };
}

/** Open an add-exercise form idempotently (a re-render mid-click can double-toggle it). */
async function openAddForm(page: Page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByRole("button", { name: "Add exercise" }).click();
    try {
      await expect(page.getByPlaceholder("Search or create an exercise")).toBeVisible({ timeout: 3000 });
      return;
    } catch {
      // Form still closed: toggle again.
    }
  }
  await expect(page.getByPlaceholder("Search or create an exercise")).toBeVisible();
}

test("full flow: signup, onboarding, exercise, plan, schedule, workout, stats", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());

  // 1. Sign up.
  await page.goto("/register");
  await page.getByPlaceholder("Your name").fill("E2E Tester");
  await page.getByPlaceholder("name@example.com").fill(email);
  await page.getByPlaceholder("at least 8 characters").fill(password);
  await page.getByRole("button", { name: "SIGN UP" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);

  // 2. Onboarding.
  await page.getByLabel("Age").fill("30");
  await page.getByLabel("Height (cm)").fill("180");
  await page.getByRole("button", { name: "Male", exact: true }).click();
  await page.getByLabel("Weight (kg)").fill("80");
  await page.getByRole("button", { name: "SAVE" }).click();
  await expect(page).toHaveURL(/\/onboarding\/notifications/);
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page).toHaveURL("/");

  // 3. Exercise library: bodyweight exercise with defaults.
  await page.goto("/exercises");
  await page.getByRole("button", { name: "Add exercise" }).click();
  await page.getByPlaceholder("E.g. Squat").fill("E2E Push-up");
  await page.getByRole("button", { name: "Bodyweight" }).click();
  await page.getByLabel("Default sets", { exact: true }).fill("2");
  await page.getByLabel("Target (reps)", { exact: true }).fill("15");
  await page.getByLabel("Rest", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("E2E Push-up")).toBeVisible();
  await expect(
    page.getByText("Bodyweight · 2 sets · target 15 reps · rest 5s")
  ).toBeVisible();

  // 3b. The edit screen for an existing exercise uses the clear layout.
  await page.getByRole("button", { name: "Edit E2E Push-up" }).click();
  await expect(page.getByLabel("Target (reps)", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();
  await expect(page.getByText("Archive exercise")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  // 3c. A weight exercise for the 60 kg PR check.
  await page.getByRole("button", { name: "Add exercise" }).click();
  await page.getByPlaceholder("E.g. Squat").fill("E2E Bench");
  await page.getByRole("button", { name: "Weight", exact: true }).click();
  await page.getByLabel("Default sets", { exact: true }).fill("1");
  await page.getByLabel("Rest", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("E2E Bench")).toBeVisible();

  // 3d. A hold exercise with a short goal for the hold timer check.
  await page.getByRole("button", { name: "Add exercise" }).click();
  await page.getByPlaceholder("E.g. Squat").fill("E2E Plank");
  await page.getByRole("button", { name: "Hold", exact: true }).click();
  await page.getByLabel("Default sets", { exact: true }).fill("1");
  await page.getByLabel("Target (seconds)", { exact: true }).fill("2");
  await page.getByLabel("Rest", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("E2E Plank")).toBeVisible();

  // 4. Schedule: create a plan and assign it to Monday.
  await page.goto("/schedule");
  await page.getByRole("button", { name: "New plan" }).click();
  await page.getByPlaceholder("E.g. Push A").fill("E2E Plan");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("link", { name: /E2E Plan/ })).toBeVisible();
  await page.getByLabel("Monday").selectOption({ label: "E2E Plan" });

  // 5. Plan: add the exercise twice (duplicates allowed).
  await page.getByRole("link", { name: /E2E Plan/ }).click();
  await expect(page).toHaveURL(/\/plans\/.+/);
  const planId = page.url().split("/plans/")[1].split(/[?#]/)[0];
  await openAddForm(page);
  await page.getByPlaceholder("Search or create an exercise").fill("E2E Push-up");
  await page.getByRole("button", { name: /E2E Push-up/ }).first().click();
  await expect(page.getByLabel("Sets")).toHaveValue("2");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("E2E Push-up").first()).toBeVisible();
  // Second placement of the same exercise.
  await openAddForm(page);
  await page.getByPlaceholder("Search or create an exercise").fill("E2E Push-up");
  await page.getByRole("button", { name: /E2E Push-up/ }).first().click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("E2E Push-up")).toHaveCount(2);
  // Third placement: the weight exercise.
  await openAddForm(page);
  await page.getByPlaceholder("Search or create an exercise").fill("E2E Bench");
  await page.getByRole("button", { name: /E2E Bench/ }).first().click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("E2E Bench")).toBeVisible();
  // Fourth placement: the hold exercise.
  await openAddForm(page);
  await page.getByPlaceholder("Search or create an exercise").fill("E2E Plank");
  await page.getByRole("button", { name: /E2E Plank/ }).first().click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("E2E Plank")).toBeVisible();

  // Reorder by dragging Bench to the top; the order persists after reload.
  const grips = page.getByRole("button", { name: "Drag to reorder" });
  await expect(grips).toHaveCount(4);
  await page.evaluate(() => document.fonts.ready);
  const rows = page.locator("[data-exercise-id]");
  await rows.nth(2).scrollIntoViewIfNeeded();
  for (let attempt = 0; attempt < 3; attempt++) {
    const source = await grips.nth(2).boundingBox();
    const firstRow = await rows.first().boundingBox();
    if (!source || !firstRow) throw new Error("missing drag boxes");
    const sx = source.x + source.width / 2;
    const sy = source.y + source.height / 2;
    const tx = firstRow.x + firstRow.width / 2;
    const ty = firstRow.y + firstRow.height / 2;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move((sx + tx) / 2, (sy + ty) / 2, { steps: 15 });
    await page.waitForTimeout(150);
    await page.mouse.move(tx, ty, { steps: 15 });
    await page.waitForTimeout(250);
    await page.mouse.up();
    try {
      await expect(rows.first().getByText("E2E Bench")).toBeVisible({ timeout: 4000 });
      break;
    } catch {
      if (attempt === 2) throw new Error("drag reorder did not stick");
    }
  }
  await expect(
    page.locator("[data-exercise-id]").first().getByText("E2E Bench")
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator("[data-exercise-id]").first().getByText("E2E Bench")
  ).toBeVisible();

  // 6. Workout, one exercise at a time (Bench was dragged to the top).
  await page.goto(`/workout/active?planId=${planId}`);
  await expect(page.getByText("Exercise 1 of 4")).toBeVisible();
  // Headless browsers cannot reach FCM: inject a fabricated subscription so
  // the real client scheduling path runs against the local push stub.
  await page.evaluate((sub) => {
    (window as unknown as { __repiqTestPushSubscription?: unknown }).__repiqTestPushSubscription = {
      endpoint: sub.endpoint,
      toJSON: () => sub,
    };
  }, fakePushSubscription());
  await page.getByLabel("Set 1 weight in kilos").fill("60");
  await page.getByLabel("Set 1 reps").fill("8");
  await page.getByRole("button", { name: "Check off set 1" }).click();
  // Rest push stays pending until it fires, then marks sent.
  await expect
    .poll(async () => restTimerStatus(page), { timeout: 10000 })
    .toBe("pending");
  await expect
    .poll(async () => restTimerStatus(page), { timeout: 30000 })
    .toBe("sent");
  // Next exercise: bodyweight has no weight field, reps only.
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Exercise 2 of 4")).toBeVisible();
  await expect(page.getByLabel(/weight in kilos/)).toHaveCount(0);
  await page.getByLabel("Set 1 reps").fill("10");
  await page.getByRole("button", { name: "Check off set 1" }).click();
  // Rest timer: Skip only, nothing editable.
  await expect(page.getByRole("button", { name: "Skip rest" })).toBeVisible();
  await expect(page.locator("div.fixed.top-3 input")).toHaveCount(0);
  await page.getByRole("button", { name: "Skip rest" }).click();
  await page.getByLabel("Set 2 reps").fill("12");
  await page.getByRole("button", { name: "Check off set 2" }).click();
  await page.getByRole("button", { name: "Skip rest" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Exercise 3 of 4")).toBeVisible();
  await page.getByLabel("Set 1 reps").fill("8");
  await page.getByRole("button", { name: "Check off set 1" }).click();
  await page.getByRole("button", { name: "Skip rest" }).click();
  await page.getByLabel("Set 2 reps").fill("9");
  await page.getByRole("button", { name: "Check off set 2" }).click();
  await page.getByRole("button", { name: "Skip rest" }).click();
  // Fourth exercise: hold timer with a 2-second goal.
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Exercise 4 of 4")).toBeVisible();
  await page.getByRole("button", { name: "Start hold" }).click();
  await expect(page.getByText("GET READY")).toBeVisible();
  await expect(page.getByRole("button", { name: "SAVE" })).toBeVisible({ timeout: 25000 });
  await page.getByRole("button", { name: "One second less" }).click();
  await page.getByRole("button", { name: "SAVE" }).click();
  await expect(page.getByRole("button", { name: "Set 1 checked off" })).toBeVisible();
  await page.getByRole("button", { name: "Skip rest" }).click();
  await page.getByRole("button", { name: "FINISH WORKOUT" }).click();
  // Summary screen of the finished workout.
  await expect(page).toHaveURL(/\/workout\/summary\/.+/);
  await expect(page.getByText("E2E Plan").first()).toBeVisible();
  await expect(page.getByText("6 sets · 480 kg")).toBeVisible();
  await page.getByRole("link", { name: "DONE" }).click();
  await expect(page).toHaveURL("/");

  // 7. Second workout: placeholders from last time + "same as last time".
  await page.goto(`/workout/active?planId=${planId}`);
  await expect(page.getByText("Exercise 1 of 4")).toBeVisible();
  // Bench history: set 1 was logged as 60 kg x 8.
  expect(await page.getByLabel("Set 1 reps").getAttribute("placeholder")).toBe("8");
  await expect(
    page.getByRole("button", { name: "Same as last time" })
  ).toBeVisible();
  // Finish empty (confirm dialog auto-accepted) lands on its summary too.
  // Finish only shows on the final exercise.
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Exercise 4 of 4")).toBeVisible();
  await page.getByRole("button", { name: "FINISH WORKOUT" }).click();
  await expect(page).toHaveURL(/\/workout\/summary\/.+/);
  await expect(page.getByText("No sets logged")).toBeVisible();
  await page.getByRole("link", { name: "DONE" }).click();
  await expect(page).toHaveURL("/");

  // 8. Stats show the finished workout.
  await page.goto("/analytics");
  await expect(page.getByText("STATISTICS")).toBeVisible();
  await expect(page.getByText("E2E Push-up").first()).toBeVisible();
  await expect(page.getByText("E2E Plan").first()).toBeVisible();
  await expect(page.getByText("History")).toBeVisible();
  // Logging 60 kg gives a PR of 60 kg, and the hold shows its seconds.
  await expect(page.getByText("E2E Bench").first()).toBeVisible();
  await expect(page.getByText("60", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("E2E Plank").first()).toBeVisible();
  // Every history workout links straight to the same summary screen.
  await page.getByRole("link", { name: /E2E Plan/ }).first().click();
  await expect(page).toHaveURL(/\/workout\/summary\/.+/);
  await expect(page.getByText("E2E Plan").first()).toBeVisible();
  await page.getByRole("link", { name: "DONE" }).click();
  await expect(page).toHaveURL("/analytics");

  // Notifications screen renders with device status and reminder controls.
  await page.goto("/notifications");
  await expect(page.getByText("This device")).toBeVisible();
  await expect(page.getByText("Rest timer")).toBeVisible();
  await expect(page.getByText("Daily reminder")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send test notification" })).toBeVisible();
});
