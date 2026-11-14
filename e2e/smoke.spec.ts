import { expect, test } from "@playwright/test";

/** Signs this browser context in with `role`; NODE_ENV=test only (src/server/auth/test-login.ts). */
async function signIn(page: import("@playwright/test").Page, role: "admin" | "accountant" | "operator" | "viewer") {
  const res = await page.request.post("/api/test/login", { data: { role } });
  expect(res.ok()).toBe(true);
}

test("signed out, a deep link goes to sign in", async ({ page }) => {
  await page.goto("/sales/invoices");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page).toHaveURL("/sign-in?returnTo=%2Fsales%2Finvoices");
});

test("admin signs in and sees the layout", async ({ page }) => {
  await signIn(page, "admin");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /^Good (morning|afternoon|evening), E2E$/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent documents" })).toBeVisible(); // the dashboard API answered
  await page.getByRole("button", { name: "Account: E2E admin" }).click();
  await expect(page.getByRole("dialog").getByText("E2E admin")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await page.keyboard.press("Escape");

  const nav = page.getByRole("navigation", { name: "Sections" });
  await nav.getByRole("button", { name: "Sales" }).click(); // opens the section
  await nav.getByRole("link", { name: "Quotations" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Quotations" })).toBeVisible();
  await expect(page).toHaveURL("/sales/quotations");
});
