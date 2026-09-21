import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("e2e-storage-initialized")) {
      localStorage.clear();
      sessionStorage.setItem("e2e-storage-initialized", "true");
    }
  });
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
    return { drawerBottom: drawer.bottom, drawerTop: drawer.top, drawerHeight: drawer.height, railBottom: rail.bottom, viewportHeight: innerHeight, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  expect(layout.drawerTop).toBeGreaterThanOrEqual(0);
  expect(layout.drawerBottom).toBeLessThanOrEqual(layout.railBottom);
  expect(layout.railBottom).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.drawerHeight).toBeLessThanOrEqual(layout.viewportHeight * 0.33);
  expect(layout.overflow).toBeLessThanOrEqual(0);
});

test("mobile chrome keeps the page readable and clear of the bottom toolbar", async ({ page }) => {
  await page.getByRole("button", { name: "Open My August Journal" }).click();
  await expect(page.locator(".page-finder")).toBeHidden();
  await page.getByRole("button", { name: "Pages" }).click();
  await expect(page.locator(".page-finder")).toBeVisible();
  const metadataSize = await page.locator(".page-identity label span").first().evaluate(element => parseFloat(getComputedStyle(element).fontSize));
  expect(metadataSize).toBeGreaterThanOrEqual(10);
  await page.getByRole("button", { name: "Pages" }).click();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const clearance = await page.evaluate(() => {
    const paper = document.querySelector(".journal-page")!.getBoundingClientRect();
    const toolbar = document.querySelector(".tool-rail")!.getBoundingClientRect();
    return toolbar.top - paper.bottom;
  });
  expect(clearance).toBeGreaterThanOrEqual(8);
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

test("long journal writing scrolls inside the mobile page", async ({ page }) => {
  await page.getByRole("button", { name: "Open My August Journal" }).click();
  const writing = page.locator(".writing-area textarea");
  await writing.fill(Array.from({ length: 40 }, (_, index) => `Journal line ${index + 1}`).join("\n"));
  const scroll = await writing.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return { scrollable: element.scrollHeight > element.clientHeight, reachedEnd: element.scrollTop + element.clientHeight >= element.scrollHeight - 2 };
  });
  expect(scroll.scrollable).toBe(true);
  expect(scroll.reachedEnd).toBe(true);
});

test("mobile date and little joys remain readable without mood crowding", async ({ page }) => {
  await page.getByRole("button", { name: "Open My August Journal" }).click();
  await expect(page.getByText(/today’s mood/i)).toHaveCount(0);
  const date = page.getByRole("textbox", { name: "Date" });
  const dateBox = await date.boundingBox();
  expect(dateBox?.width).toBeGreaterThanOrEqual(100);
  expect(dateBox?.height).toBeGreaterThanOrEqual(32);
  const identityBox = await page.locator(".journal-page .page-identity").boundingBox();
  const dateHeadingBox = await page.locator(".journal-page .date-row").boundingBox();
  expect(dateHeadingBox!.y).toBeGreaterThan(identityBox!.y + identityBox!.height);
  const joys = page.locator(".tiny-list");
  const fit = await joys.evaluate(element => ({ clientHeight: element.clientHeight, pageHeight: element.parentElement?.parentElement?.clientHeight ?? 0 }));
  expect(fit.clientHeight).toBeLessThan(fit.pageHeight * 0.35);
  await expect(joys.getByRole("checkbox")).toHaveCount(0);
  const firstJoy = joys.getByRole("textbox", { name: "Strikethrough slow mornings" });
  await firstJoy.click();
  await expect(joys.locator('input[value="slow mornings"]')).toHaveClass(/done/);
  await expect(joys.locator(".joy-strike")).toHaveCount(0);
});

test("many large photos are processed sequentially and remain visible after saving", async ({ page }) => {
  await page.getByRole("button", { name: "Open My August Journal" }).click();
  await page.getByRole("button", { name: "Photos" }).click();
  const files = Array.from({ length: 12 }, (_, index) => ({
    name: `memory-${index}.svg`,
    mimeType: "image/svg+xml",
    buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="3000"><rect width="4000" height="3000" fill="hsl(${index * 30} 55% 65%)"/></svg>`),
  }));
  await page.locator('.tool-photos input[type="file"]').setInputFiles(files);
  const photos = page.locator(".journal-page .placed-photo img");
  await expect(photos).toHaveCount(12, { timeout: 20_000 });
  await expect.poll(() => photos.evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await page.getByRole("button", { name: /Save|Saved quietly/ }).click();
  await page.reload();
  await page.getByRole("button", { name: "Open My August Journal" }).click();
  await expect(page.locator(".journal-page .placed-photo img")).toHaveCount(12);
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

test("desktop leaves share one proportional template", async ({ page }) => {
  await page.getByRole("button", { name: "Open My August Journal" }).click();
  await page.getByRole("button", { name: "New page" }).click();
  await page.setViewportSize({ width: 1280, height: 900 });
  const layout = await page.locator(".book-spread").evaluate((spread) => {
    const measure = (leaf: Element) => {
      const pageBox = leaf.getBoundingClientRect();
      const normalized = (selector: string) => {
        const box = leaf.querySelector(selector)!.getBoundingClientRect();
        return { top: (box.top - pageBox.top) / pageBox.height, width: box.width / pageBox.width, height: box.height / pageBox.height };
      };
      return { identity: normalized(".page-identity"), date: normalized(".date-row"), title: normalized(".journal-title"), writing: normalized(".writing-area"), joys: normalized(".tiny-list"), quote: normalized("blockquote") };
    };
    return { left: measure(spread.querySelector(".side-left")!), right: measure(spread.querySelector(".side-right")!) };
  });
  for (const key of ["identity", "date", "title", "writing", "joys", "quote"] as const) {
    expect(layout.left[key].top).toBeCloseTo(layout.right[key].top, 2);
    expect(layout.left[key].width).toBeCloseTo(layout.right[key].width, 2);
    expect(layout.left[key].height).toBeCloseTo(layout.right[key].height, 2);
  }
  await expect(page.locator(".companion-number")).toHaveCount(2);
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
  await page.getByRole("button", { name: "Pages" }).click();
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
