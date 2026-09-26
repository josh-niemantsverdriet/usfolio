import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("collection and detail dialog meet automated WCAG AA checks", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Jamie’s collection." }),
  ).toBeVisible();
  const scan = () =>
    new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
  let result = await scan();
  expect(result.violations).toEqual([]);
  await page.getByRole("button", { name: "View My usual coffee" }).click();
  result = await scan();
  expect(result.violations).toEqual([]);
});
