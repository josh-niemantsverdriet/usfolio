import { test, expect } from "@playwright/test";
test("browses, searches and filters the shared collection", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Jamie’s collection." }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Search details" }).fill("oat milk");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByText("Iced oat milk latte")).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await page.getByRole("button", { name: "Sizes 3 details" }).click();
  await expect(page.getByRole("article")).toHaveCount(3);
  await page.getByRole("button", { name: "All categories" }).click();
  await page.getByRole("button", { name: "Quick picks" }).click();
  await expect(page.getByRole("article")).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
test("adds, edits and deletes a private detail, with persistence and keyboard dialog support", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  if (testInfo.project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("button", { name: "My collection", exact: true })
    .click();
  await page.getByRole("button", { name: "Add a detail", exact: true }).click();
  await page.getByLabel("Give it a name").fill("Ring for right hand");
  await page.getByLabel("The little detail").fill("US 7");
  await page.getByLabel("Who can see this?").selectOption("private");
  await page.getByRole("button", { name: "Save detail", exact: true }).click();
  await expect(page.getByText("US 7")).toBeVisible();
  await page.reload();
  if (testInfo.project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("button", { name: "My collection", exact: true })
    .click();
  await page.getByRole("button", { name: "View Ring for right hand" }).click();
  await expect(page.getByLabel("Who can see this?")).toHaveValue("private");
  await page.getByLabel("The little detail").fill("US 8");
  await page.getByRole("button", { name: "Save detail", exact: true }).click();
  await expect(page.getByText("US 8", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "View Ring for right hand" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "View Ring for right hand" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByText("Ring for right hand")).not.toBeVisible();
});
test("partner editing does not expose privacy or deletion controls; disconnect retains own collection", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "View My usual coffee" }).click();
  await expect(page.getByLabel("Who can see this?")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Delete", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("The little detail").fill("Hot oat milk latte");
  await page.getByRole("button", { name: "Save detail" }).click();
  await expect(page.getByText("Hot oat milk latte")).toBeVisible();
  if (testInfo.project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("button", { name: "Our connection", exact: true })
    .click();
  await page.getByRole("button", { name: "Disconnect from partner" }).click();
  await page.getByRole("button", { name: "Yes, disconnect" }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  if (
    testInfo.project.name === "mobile" &&
    (await page.getByRole("button", { name: "Close navigation" }).isVisible())
  )
    await page.getByRole("button", { name: "Close navigation" }).click();
  await expect(
    page.getByRole("heading", { name: "Your little details." }),
  ).toBeVisible();
  await expect(page.getByText("Flat white", { exact: true })).toBeVisible();
  await expect(page.getByText("Hot oat milk latte")).toHaveCount(0);
});
