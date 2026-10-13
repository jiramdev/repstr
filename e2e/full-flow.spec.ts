import { expect, test, type Page } from "@playwright/test";

const email = `e2e-${Date.now()}@example.com`;
const password = "e2e-password-long";

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

  // 6. Workout, one exercise at a time.
  await page.goto(`/workout/active?planId=${planId}`);
  await expect(page.getByText("Exercise 1 of 2")).toBeVisible();
  await expect(page.getByText("Set 1 of 2")).toBeVisible();
  // Bodyweight: no weight field, reps only.
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
  // Next exercise.
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Exercise 2 of 2")).toBeVisible();
  await page.getByLabel("Set 1 reps").fill("8");
  await page.getByRole("button", { name: "Check off set 1" }).click();
  await page.getByRole("button", { name: "Skip rest" }).click();
  await page.getByLabel("Set 2 reps").fill("9");
  await page.getByRole("button", { name: "Check off set 2" }).click();
  await page.getByRole("button", { name: "Skip rest" }).click();
  await page.getByRole("button", { name: "FINISH WORKOUT" }).click();
  await expect(page).toHaveURL("/");

  // 7. Second workout: placeholders from last time + "same as last time".
  await page.goto(`/workout/active?planId=${planId}`);
  await expect(page.getByText("Exercise 1 of 2")).toBeVisible();
  // Both placements share one exercise history; set 1 was logged as 10 and 8.
  expect(await page.getByLabel("Set 1 reps").getAttribute("placeholder")).toMatch(/^(8|10)$/);
  await expect(
    page.getByRole("button", { name: "Same as last time" })
  ).toBeVisible();
  // Finish empty (confirm dialog auto-accepted).
  await page.getByRole("button", { name: "FINISH WORKOUT" }).click();
  await expect(page).toHaveURL("/");

  // 8. Stats show the finished workout.
  await page.goto("/analytics");
  await expect(page.getByText("STATISTICS")).toBeVisible();
  await expect(page.getByText("E2E Push-up").first()).toBeVisible();
  await expect(page.getByText("E2E Plan").first()).toBeVisible();
  await expect(page.getByText("History")).toBeVisible();
});
