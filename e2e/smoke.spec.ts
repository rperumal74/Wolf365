import { test, expect } from "@playwright/test";

/**
 * Unauthenticated smoke tests — prove the app boots, the sign-in page renders,
 * and protected routes redirect to sign-in. These need no credentials.
 *
 * To extend into authenticated flows (dashboard MRR, CRM forecast grid, creating
 * an opportunity), inject a database session cookie for a seeded test user in a
 * global-setup step, then navigate to the protected routes. See docs/LOCAL_DEV.md.
 */

test("sign-in page renders the brand and an action", async ({ page }) => {
  await page.goto("/signin");
  await expect(
    page.getByRole("heading", { name: /Microsoft 365 Billing Application/i }),
  ).toBeVisible();
  // Either the SSO button (configured) or the bootstrap notice (not configured).
  const ssoButton = page.getByRole("button", { name: /Sign in with Microsoft/i });
  const notConfigured = page.getByText(/SSO is not configured/i);
  await expect(ssoButton.or(notConfigured)).toBeVisible();
});

test("protected route redirects to sign-in when unauthenticated", async ({ page }) => {
  await page.goto("/crm/forecast");
  await expect(page).toHaveURL(/\/signin/);
});

test("access-denied message shows for rejected sign-ins", async ({ page }) => {
  await page.goto("/signin?error=AccessDenied");
  await expect(page.getByText(/account hasn.t been set up/i)).toBeVisible();
});
