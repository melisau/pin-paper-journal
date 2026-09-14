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
  await expect(page.locator(".tool-drawer")).toBeHidden();
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

test("long page titles wrap without leaving the paper", async ({ page }) => {
  await page.getByRole("button", { name: "Open My August Journal" }).click();
  const title = page.getByRole("textbox", { name: "Page title" });
  await title.fill("Today, I want to remember the quiet details that made this very long day feel especially meaningful");
  const sizing = await title.evaluate((element) => {
    const field = element as HTMLTextAreaElement;
    const page = field.closest(".journal-page")!.getBoundingClientRect();
    const box = field.getBoundingClientRect();
    return { wraps: field.scrollHeight > parseFloat(getComputedStyle(field).lineHeight), inside: box.right <= page.right };
  });
  expect(sizing.wraps).toBe(true);
  expect(sizing.inside).toBe(true);
});

test("page geometry and decoration coordinates stay stable across mobile and desktop", async ({ page }) => {
  await page.getByRole("button", { name: "Open My August Journal" }).click();
  await page.getByRole("button", { name: "Stickers" }).click();
  await page.locator(".sticker-grid button").first().click();
  const journal = page.locator(".journal-page");
  const sticker = journal.locator(".placed-sticker").first();

  const mobile = await journal.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const item = element.querySelector<HTMLElement>(".placed-sticker")!;
    return { ratio: box.width / box.height, left: item.style.left, top: item.style.top };
  });
  expect(mobile.ratio).toBeCloseTo(0.7, 1);

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator(".companion-page")).toBeVisible();
  const desktop = await journal.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const item = element.querySelector<HTMLElement>(".placed-sticker")!;
    return { ratio: box.width / box.height, left: item.style.left, top: item.style.top };
  });
  expect(desktop.ratio).toBeCloseTo(0.7, 1);
  expect(desktop.left).toBe(mobile.left);
  expect(desktop.top).toBe(mobile.top);
  await expect(sticker).toBeVisible();
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
