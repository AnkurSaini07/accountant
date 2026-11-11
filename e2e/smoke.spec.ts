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
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard (CI probe: must fail)" })).toBeVisible({ timeout: 2000 });
  await expect(page.getByText("E2E admin")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  const nav = page.getByRole("treegrid", { name: "Sections" });
  await nav.getByRole("link", { name: "Sales" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Sales" })).toBeVisible();
  await expect(page).toHaveURL("/sales");
});
