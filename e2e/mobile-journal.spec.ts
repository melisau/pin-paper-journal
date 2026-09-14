import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/preview");
});

test("library fits the viewport and supports renaming", async ({ page }) => {
  await expect(page.getByRole("heading", { name: /Your little corner/ })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "Edit library" }).click();
  await page.getByRole("button", { name: "Rename My August Journal" }).click();
  const name = page.getByRole("textbox", { name: "Journal name" });
  await name.fill("Mobile Notes");
  await name.press("Enter");
  await expect(page.getByRole("button", { name: "Open Mobile Notes" })).toBeVisible();
});

test("creative drawer stays usable inside a short mobile viewport", async ({ page }) => {
  await page.getByRole("button", { name: "Open My August Journal" }).click();
  await page.getByRole("button", { name: "Photos" }).click();
  await expect(page.getByText("Add pictures")).toBeVisible();

  const layout = await page.evaluate(() => {
    const drawer = document.querySelector(".tool-drawer")!.getBoundingClientRect();
    const rail = document.querySelector(".tool-rail")!.getBoundingClientRect();
    return { drawerBottom: drawer.bottom, drawerTop: drawer.top, railBottom: rail.bottom, viewportHeight: innerHeight, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  expect(layout.drawerTop).toBeGreaterThanOrEqual(0);
  expect(layout.drawerBottom).toBeLessThanOrEqual(layout.railBottom);
  expect(layout.railBottom).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.overflow).toBeLessThanOrEqual(0);
});

test("undo, redo, page ordering and deletion work", async ({ page }) => {
  await page.getByRole("button", { name: "Open My August Journal" }).click();
  const title = page.locator(".journal-title");
  const original = await title.inputValue();
  await title.fill("A changed title");
  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled({ timeout: 2_000 });
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(title).toHaveValue(original);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(title).toHaveValue("A changed title");

  await page.getByRole("button", { name: "New page" }).click();
  await expect(page.getByRole("button", { name: "Move page left" })).toBeEnabled();
  await page.getByRole("button", { name: "Move page left" }).click();
  await expect(page.getByRole("textbox", { name: "Page name", exact: true })).toHaveValue("Page 2");

  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Delete page" }).click();
  await expect(page.getByRole("button", { name: /Today 2026/ })).toBeVisible();
});

test("local backup exports and imports validated journal data", async ({ page }) => {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^pin-paper-backup-\d{4}-\d{2}-\d{2}\.json$/);

  const backup = {
    app: "pin-paper-journal",
    version: 1,
    exportedAt: new Date().toISOString(),
    books: [{ id: "imported", title: "Imported Journal", tone: "blue", label: "restored" }],
    journals: {},
  };
  page.once("dialog", dialog => dialog.accept());
  await page.locator('input[type="file"]').setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.getByRole("button", { name: "Open Imported Journal" })).toBeVisible();
});
