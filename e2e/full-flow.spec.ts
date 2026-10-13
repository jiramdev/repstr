import { expect, test, type Page } from "@playwright/test";

const email = `e2e-${Date.now()}@example.com`;
const password = "e2e-wachtwoord-lang";

/** Open an add-exercise form idempotently (a re-render mid-click can double-toggle it). */
async function openAddForm(page: Page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByRole("button", { name: "Oefening toevoegen" }).click();
    try {
      await expect(page.getByPlaceholder("Zoek of maak een oefening")).toBeVisible({ timeout: 3000 });
      return;
    } catch {
      // Form still closed: toggle again.
    }
  }
  await expect(page.getByPlaceholder("Zoek of maak een oefening")).toBeVisible();
}

test("full flow: signup, onboarding, exercise, plan, schedule, workout, stats", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());

  // 1. Sign up.
  await page.goto("/register");
  await page.getByPlaceholder("Je naam").fill("E2E Tester");
  await page.getByPlaceholder("naam@voorbeeld.nl").fill(email);
  await page.getByPlaceholder("minstens 8 tekens").fill(password);
  await page.getByRole("button", { name: "REGISTREREN" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);

  // 2. Onboarding.
  await page.getByLabel("Leeftijd").fill("30");
  await page.getByLabel("Lengte (cm)").fill("180");
  await page.getByRole("button", { name: "Man" }).click();
  await page.getByLabel("Gewicht (kg)").fill("80");
  await page.getByRole("button", { name: "OPSLAAN" }).click();
  await expect(page).toHaveURL(/\/onboarding\/notifications/);
  await page.getByRole("button", { name: "Niet nu" }).click();
  await expect(page).toHaveURL("/");

  // 3. Exercise library: bodyweight exercise with defaults.
  await page.goto("/exercises");
  await page.getByRole("button", { name: "Oefening toevoegen" }).click();
  await page.getByPlaceholder("Naam, bijv. Squat").fill("E2E Push-up");
  await page.getByRole("button", { name: "Lichaamsgewicht" }).click();
  await page.getByLabel("Standaard sets").fill("2");
  await page.getByLabel("Doel reps of seconden").fill("15");
  await page.getByLabel("Rust in seconden").fill("5");
  await page.getByRole("button", { name: "Toevoegen", exact: true }).click();
  await expect(page.getByText("E2E Push-up")).toBeVisible();
  await expect(
    page.getByText("Lichaamsgewicht · 2 sets · doel 15 reps · rust 5s")
  ).toBeVisible();

  // 4. Schedule: create a plan and assign it to Monday.
  await page.goto("/schedule");
  await page.getByRole("button", { name: "Nieuw plan" }).click();
  await page.getByPlaceholder("Bijv. Push A").fill("E2E Plan");
  await page.getByRole("button", { name: "Opslaan" }).click();
  await expect(page.getByRole("link", { name: /E2E Plan/ })).toBeVisible();
  await page.getByLabel("Maandag").selectOption({ label: "E2E Plan" });

  // 5. Plan: add the exercise twice (duplicates allowed).
  await page.getByRole("link", { name: /E2E Plan/ }).click();
  await expect(page).toHaveURL(/\/plans\/.+/);
  const planId = page.url().split("/plans/")[1].split(/[?#]/)[0];
  await openAddForm(page);
  await page.getByPlaceholder("Zoek of maak een oefening").fill("E2E Push-up");
  await page.getByRole("button", { name: /E2E Push-up/ }).first().click();
  await expect(page.getByLabel("Sets")).toHaveValue("2");
  await page.getByRole("button", { name: "Toevoegen", exact: true }).click();
  await expect(page.getByText("E2E Push-up").first()).toBeVisible();
  // Second placement of the same exercise.
  await openAddForm(page);
  await page.getByPlaceholder("Zoek of maak een oefening").fill("E2E Push-up");
  await page.getByRole("button", { name: /E2E Push-up/ }).first().click();
  await page.getByRole("button", { name: "Toevoegen", exact: true }).click();
  await expect(page.getByText("E2E Push-up")).toHaveCount(2);

  // 6. Workout, one exercise at a time.
  await page.goto(`/workout/active?planId=${planId}`);
  await expect(page.getByText("Oefening 1 van 2")).toBeVisible();
  await expect(page.getByText("Set 1 van 2")).toBeVisible();
  // Bodyweight: no weight field, reps only.
  await expect(page.getByLabel(/gewicht in kilo/)).toHaveCount(0);
  await page.getByLabel("Set 1 herhalingen").fill("10");
  await page.getByRole("button", { name: "Set 1 afvinken" }).click();
  // Rest timer: Skip only, nothing editable.
  await expect(page.getByRole("button", { name: "Rust overslaan" })).toBeVisible();
  await expect(page.locator("div.fixed.top-3 input")).toHaveCount(0);
  await page.getByRole("button", { name: "Rust overslaan" }).click();
  await page.getByLabel("Set 2 herhalingen").fill("12");
  await page.getByRole("button", { name: "Set 2 afvinken" }).click();
  await page.getByRole("button", { name: "Rust overslaan" }).click();
  // Next exercise.
  await page.getByRole("button", { name: "Volgende" }).click();
  await expect(page.getByText("Oefening 2 van 2")).toBeVisible();
  await page.getByLabel("Set 1 herhalingen").fill("8");
  await page.getByRole("button", { name: "Set 1 afvinken" }).click();
  await page.getByRole("button", { name: "Rust overslaan" }).click();
  await page.getByLabel("Set 2 herhalingen").fill("9");
  await page.getByRole("button", { name: "Set 2 afvinken" }).click();
  await page.getByRole("button", { name: "Rust overslaan" }).click();
  await page.getByRole("button", { name: "SESSIE VOLTOOIEN" }).click();
  await expect(page).toHaveURL("/");

  // 7. Second workout: placeholders from last time + "same as last time".
  await page.goto(`/workout/active?planId=${planId}`);
  await expect(page.getByText("Oefening 1 van 2")).toBeVisible();
  // Both placements share one exercise history; set 1 was logged as 10 and 8.
  expect(await page.getByLabel("Set 1 herhalingen").getAttribute("placeholder")).toMatch(/^(8|10)$/);
  await expect(
    page.getByRole("button", { name: "Zelfde als vorige keer" })
  ).toBeVisible();
  // Finish empty (confirm dialog auto-accepted).
  await page.getByRole("button", { name: "SESSIE VOLTOOIEN" }).click();
  await expect(page).toHaveURL("/");

  // 8. Stats show the finished workout.
  await page.goto("/analytics");
  await expect(page.getByText("STATISTIEKEN")).toBeVisible();
  await expect(page.getByText("E2E Push-up").first()).toBeVisible();
  await expect(page.getByText("E2E Plan").first()).toBeVisible();
  await expect(page.getByText("Geschiedenis")).toBeVisible();
});
