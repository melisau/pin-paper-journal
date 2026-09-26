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
  const shelfArt = await page.request.get("/library-shelf.png");
  expect(shelfArt.ok()).toBe(true);
  await expect(page.locator(".wood-shelf")).toHaveCSS("background-image", /library-shelf\.png/);
  await expect(page.locator(".wood-shelf")).toHaveCSS("background-repeat", "no-repeat");
  const shelfBounds = await page.locator(".wood-shelf").boundingBox();
  expect(shelfBounds!.x).toBeGreaterThanOrEqual(-1);
  expect(shelfBounds!.x).toBeLessThanOrEqual(1);
  expect(shelfBounds!.width).toBeCloseTo(await page.evaluate(() => innerWidth), 0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const shelf = page.locator(".books-row");
  expect(await shelf.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  await shelf.evaluate(element => element.scrollLeft = element.scrollWidth);
  await expect.poll(async () => shelf.evaluate(element => element.lastElementChild!.getBoundingClientRect().right <= element.getBoundingClientRect().right)).toBe(true);

  await page.getByRole("button", { name: "Edit library" }).click();
  await page.getByRole("button", { name: "Rename My August Journal" }).click();
  const name = page.getByRole("textbox", { name: "Journal name" });
  await name.fill("Mobile Notes");
  await name.press("Enter");
  await expect(page.getByRole("button", { name: "Open Mobile Notes" })).toBeVisible();
});

test("desktop shelf keeps the first journal reachable when many books overflow", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator(".wood-shelf")).toHaveCSS("background-repeat", "no-repeat");
  const desktopShelf = await page.locator(".wood-shelf").boundingBox();
  expect(desktopShelf!.x).toBeCloseTo(0, 0);
  expect(desktopShelf!.width).toBeCloseTo(1280, 0);
  await page.evaluate(() => {
    const books = Array.from({ length: 10 }, (_, index) => ({ id: `many-${index}`, title: `Book ${index + 1}`, tone: "rose", label: "notes", cover: index === 0 ? "journal-2" : undefined }));
    localStorage.setItem("pin-paper-journal-books", JSON.stringify(books));
  });
  await page.reload();
  const shelf = page.locator(".books-row");
  const shelfScene = page.locator(".shelf-scene");
  expect(await shelfScene.evaluate(element => element.getBoundingClientRect().width / window.innerWidth)).toBeGreaterThan(0.9);
  const first = page.getByRole("button", { name: "Open Book 1", exact: true });
  const last = page.getByRole("button", { name: "Open Book 10", exact: true });
  await expect(first).toBeVisible();
  await expect(page.getByRole("button", { name: "Scroll journals right" })).toBeVisible();
  const initial = await shelf.evaluate(element => ({ left: element.getBoundingClientRect().left, firstLeft: element.firstElementChild!.getBoundingClientRect().left, scrollLeft: element.scrollLeft, overflows: element.scrollWidth > element.clientWidth }));
  expect(initial.overflows).toBe(true);
  expect(initial.scrollLeft).toBe(0);
  expect(initial.firstLeft).toBeGreaterThanOrEqual(initial.left);
  const restingTop = await first.evaluate(element => element.getBoundingClientRect().top);
  await first.hover();
  await expect.poll(() => first.evaluate(element => element.getBoundingClientRect().top)).toBeLessThan(restingTop - 10);
  const hoverTop = await first.evaluate(element => element.getBoundingClientRect().top);
  const trackTop = await shelf.evaluate(element => element.getBoundingClientRect().top);
  expect(hoverTop).toBeGreaterThanOrEqual(trackTop + 4);
  await page.getByRole("button", { name: "Scroll journals right" }).click();
  await expect.poll(() => shelf.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  await shelf.evaluate(element => element.scrollLeft = element.scrollWidth);
  await expect.poll(() => last.evaluate(element => element.getBoundingClientRect().right <= document.querySelector(".books-row")!.getBoundingClientRect().right + 1)).toBe(true);
  await expect(page.getByRole("button", { name: "Scroll journals left" })).toBeVisible();
  await page.getByRole("button", { name: "Scroll journals left" }).click();
  await expect.poll(() => shelf.evaluate(element => element.scrollLeft < element.scrollWidth - element.clientWidth)).toBe(true);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const wideShelf = await page.locator(".wood-shelf").boundingBox();
  expect(wideShelf!.x).toBeCloseTo(0, 0);
  expect(wideShelf!.width).toBeCloseTo(1920, 0);
  expect(wideShelf!.height).toBeLessThanOrEqual(80);
});

test("desktop shelf can be dragged from a book without opening it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => {
    const books = Array.from({ length: 10 }, (_, index) => ({ id: `drag-${index}`, title: `Drag Book ${index + 1}`, tone: "rose", label: "notes" }));
    localStorage.setItem("pin-paper-journal-books", JSON.stringify(books));
  });
  await page.reload();
  const shelf = page.locator(".books-row");
  const book = page.getByRole("button", { name: "Open Drag Book 3" });
  await expect(page.getByRole("button", { name: "New journal" })).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(book).toHaveCSS("cursor", "grab");
  const bounds = await book.boundingBox();
  expect(bounds).not.toBeNull();
  const x = bounds!.x + bounds!.width / 2;
  const y = bounds!.y + bounds!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 200, y, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => shelf.evaluate(element => element.scrollLeft)).toBeGreaterThan(100);
  await expect(page.locator(".library-screen")).toBeVisible();
  const scrolledLeft = await shelf.evaluate(element => element.scrollLeft);
  const shifted = await book.boundingBox();
  await page.mouse.move(shifted!.x + shifted!.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(shifted!.x + shifted!.width / 2 + 150, y, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => shelf.evaluate(element => element.scrollLeft)).toBeLessThan(scrolledLeft - 50);
  await shelf.evaluate(element => element.scrollLeft = 0);
  await page.getByRole("button", { name: "Edit library" }).click();
  await page.getByRole("button", { name: "Rename Drag Book 1", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Journal name" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel rename" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Open Drag Book 1", exact: true }).click();
  await expect(page.locator(".desk-screen")).toBeVisible();
});

test("ready-made cover choices keep the same book frame and survive reload", async ({ page }) => {
  await page.getByRole("button", { name: "Edit library" }).click();
  await page.getByRole("button", { name: "Choose journal appearance for My August Journal" }).click();
  const options = page.locator(".appearance-cover-option");
  await expect(options).toHaveCount(13);
  await expect.poll(() => options.locator("img").evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)), { timeout: 15_000 }).toBe(true);
  const sizes = await options.locator(".appearance-cover-frame").evaluateAll(elements => elements.map(element => {
    const bounds = element.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height };
  }));
  expect(new Set(sizes.map(size => `${size.width}x${size.height}`)).size).toBe(1);
  const bodySizes = await options.locator(".appearance-cover-body").evaluateAll(elements => elements.map(element => {
    const bounds = element.getBoundingClientRect();
    return `${bounds.width}x${bounds.height}`;
  }));
  expect(new Set(bodySizes).size).toBe(1);
  await page.getByRole("button", { name: "Pastel pink linen" }).click();
  const cover = page.getByRole("button", { name: "Open My August Journal" });
  await expect(cover.locator("img.book-cover-art")).toHaveAttribute("src", /journal-10/);
  await page.getByRole("button", { name: "Done" }).click();
  const shelfGap = await cover.evaluate(element => document.querySelector(".wood-shelf")!.getBoundingClientRect().top - element.getBoundingClientRect().bottom);
  expect(shelfGap).toBeLessThanOrEqual(20);
  await page.reload();
  await expect(page.getByRole("button", { name: "Open My August Journal" }).locator("img.book-cover-art")).toHaveAttribute("src", /journal-10/);
  await page.getByRole("button", { name: "Edit library" }).click();
  await page.getByRole("button", { name: "Choose journal appearance for My August Journal" }).click();
  await page.getByRole("tab", { name: "Cover colours" }).click();
  await page.getByRole("button", { name: "Powder blue" }).click();
  await expect(page.getByRole("button", { name: "Open My August Journal" }).locator("img.book-cover-art")).toHaveCount(0);
});

test("Turkish language selection follows the user into the journal and survives reload", async ({ page }) => {
  await page.getByRole("button", { name: "TR" }).click();
  await expect(page.getByRole("heading", { name: /Küçük köşen/ })).toBeVisible();
  const actionLabels = await page.locator(".backup-action-text").evaluateAll(elements => elements.slice(0, 3).map(element => {
    const lines = Array.from(element.children).map(child => child.getBoundingClientRect());
    return { separated: lines.length === 2 && lines[1].top >= lines[0].bottom - 1, inside: element.getBoundingClientRect().width <= element.closest("button, label")!.getBoundingClientRect().width };
  }));
  expect(actionLabels.every(label => label.separated && label.inside)).toBe(true);
  await page.getByRole("button", { name: "Aç Ağustos Defterim" }).click();
  await expect(page.getByRole("button", { name: "Yeni sayfa" })).toBeVisible();
  const turkishPageLabel = await page.locator(".page-label-details summary span").evaluate(element => ({ text: element.textContent, fits: element.scrollWidth <= element.clientWidth }));
  expect(turkishPageLabel).toEqual({ text: "Bugün", fits: true });
  await page.getByRole("button", { name: "Defteri önizle" }).click();
  await expect(page.getByRole("button", { name: "Önizlemeden çık" })).toBeVisible();
  await expect(page.locator(".toolbox")).toBeHidden();
  await page.getByRole("button", { name: "Önizlemeden çık" }).click();
  await page.getByRole("button", { name: "Yaz", exact: true }).click();
  await expect(page.getByText("Yazı stili")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: /Küçük köşen/ })).toBeVisible();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Your little corner/ })).toBeVisible();
});

test("creative drawer stays usable inside a short mobile viewport", async ({ page }) => {
  await page.getByRole("button", { name: "Open My August Journal" }).click();
  await expect(page.locator(".tool-drawer")).toBeHidden();
  await page.getByRole("button", { name: "Photos" }).click();
  await expect(page.getByText("Add pictures")).toBeVisible();

  const layout = await page.evaluate(() => {
    const drawer = document.querySelector(".tool-drawer")!.getBoundingClientRect();
    const rail = document.querySelector(".tool-rail")!.getBoundingClientRect();
    return { drawerBottom: drawer.bottom, drawerTop: drawer.top, drawerHeight: drawer.height, railTop: rail.top, railBottom: rail.bottom, viewportHeight: innerHeight, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  expect(layout.drawerTop).toBeGreaterThanOrEqual(0);
  expect(layout.drawerBottom).toBeLessThanOrEqual(layout.railBottom);
  expect(layout.railBottom).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.drawerHeight).toBeLessThanOrEqual(Math.min(layout.viewportHeight * 0.4, 320) + 1);
  expect(layout.railTop - layout.drawerBottom).toBeLessThanOrEqual(8);
  expect(layout.overflow).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "Paper" }).click();
  const expanded = await page.locator(".tool-drawer").boundingBox();
  expect(expanded).not.toBeNull();
  expect(expanded!.height).toBeGreaterThan(Math.min(190, layout.viewportHeight * 0.24) + 20);
  expect(expanded!.y).toBeGreaterThanOrEqual(0);

  const paper = await page.locator(".journal-page").boundingBox();
  expect(paper).not.toBeNull();
  await page.mouse.move(paper!.x + paper!.width / 2, paper!.y + 60);
  await page.mouse.wheel(0, 1500);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const pageClearance = await page.evaluate(() => document.querySelector(".tool-drawer")!.getBoundingClientRect().top - document.querySelector(".journal-page")!.getBoundingClientRect().bottom);
  expect(pageClearance).toBeGreaterThanOrEqual(12);
});

test("mobile chrome keeps the page readable and clear of the bottom toolbar", async ({ page }) => {
  await page.getByRole("button", { name: "Open My August Journal" }).click();
  const alignment = await page.evaluate(() => {
    const paper = document.querySelector(".journal-page")!.getBoundingClientRect();
    const toolbar = document.querySelector(".tool-rail")!.getBoundingClientRect();
    return {
      pageCenter: paper.left + paper.width / 2,
      toolbarCenter: toolbar.left + toolbar.width / 2,
      viewportCenter: innerWidth / 2,
    };
  });
  expect(Math.abs(alignment.pageCenter - alignment.viewportCenter)).toBeLessThanOrEqual(1);
  expect(Math.abs(alignment.toolbarCenter - alignment.pageCenter)).toBeLessThanOrEqual(1);
  const header = await page.evaluate(() => {
    const bounds = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
    const back = bounds(".back-library");
    const navigation = bounds(".page-nav");
    const previous = bounds('.page-nav button[aria-label="Previous page"]');
    const pageDetails = bounds('.page-nav .page-label-details');
    const next = bounds('.page-nav button[aria-label="Next page"]');
    const newPage = bounds('.page-nav button[aria-label="New page"]');
    const pages = bounds('.page-nav button[aria-label="Pages"]');
    const preview = bounds('.page-nav button[aria-label="Preview journal"]');
    const save = bounds(".save-button");
    const label = document.querySelector(".page-label-details summary span")!;
    const saveLabel = document.querySelector(".save-label-mobile")!.getBoundingClientRect();
    const saveStyle = getComputedStyle(document.querySelector(".save-button")!);
    return { rowOffset: Math.abs(navigation.top - back.top), saveOffset: Math.abs(save.top - back.top), groupCenter: (back.left + save.right) / 2, viewportCenter: innerWidth / 2, previousWidth: previous.width, nextWidth: next.width, newPageWidth: newPage.width, pagesWidth: pages.width, previewWidth: preview.width, previewAligned: Math.abs(preview.top - pages.top), previewGap: preview.left - pages.right, saveWidth: save.width, saveTextFits: saveLabel.width <= save.width - parseFloat(saveStyle.paddingLeft) - parseFloat(saveStyle.paddingRight), previousToDate: pageDetails.left - previous.right, dateToNext: next.left - pageDetails.right, labelFits: label.scrollWidth <= label.clientWidth, lastGap: save.left - preview.right, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  expect(header.rowOffset).toBeLessThanOrEqual(1);
  expect(header.saveOffset).toBeLessThanOrEqual(1);
  expect(Math.abs(header.groupCenter - header.viewportCenter)).toBeLessThanOrEqual(1);
  expect(header.previousWidth).toBeGreaterThanOrEqual(32);
  expect(header.nextWidth).toBeGreaterThanOrEqual(32);
  expect(header.previousToDate).toBeGreaterThanOrEqual(0);
  expect(header.previousToDate).toBeLessThanOrEqual(4);
  expect(header.dateToNext).toBeGreaterThanOrEqual(0);
  expect(header.dateToNext).toBeLessThanOrEqual(4);
  expect(header.labelFits).toBe(true);
  expect(header.newPageWidth).toBeGreaterThanOrEqual(32);
  expect(header.pagesWidth).toBeGreaterThanOrEqual(32);
  expect(header.previewWidth).toBeGreaterThanOrEqual(32);
  expect(header.previewAligned).toBeLessThanOrEqual(1);
  expect(header.previewGap).toBeGreaterThanOrEqual(4);
  expect(header.previewGap).toBeLessThanOrEqual(12);
  expect(header.saveWidth).toBeGreaterThanOrEqual(50);
  expect(header.saveWidth).toBeLessThanOrEqual(56);
  expect(header.saveTextFits).toBe(true);
  expect(header.lastGap).toBeGreaterThanOrEqual(4);
  expect(header.lastGap).toBeLessThanOrEqual(12);
  expect(header.overflow).toBeLessThanOrEqual(0);
  expect(await page.locator(".mobile-reading-toggle").evaluate(element => element.parentElement?.classList.contains("page-nav"))).toBe(true);
  await expect(page.locator(".mobile-reading-toggle")).toBeVisible();
  await expect(page.locator(".desktop-reading-toggle")).toBeHidden();
  await expect(page.getByRole("button", { name: "Export page" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Sync history" })).toHaveCount(0);
  await page.locator(".page-label-details summary").click();
  await expect(page.locator(".page-label-popover")).toBeVisible();
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
  await expect(page.locator(".journal-page .date-row>span")).toBeHidden();
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

test("mobile paper styles keep writing inside their safe insets", async ({ page }) => {
  await page.getByRole("button", { name: "Open My August Journal" }).click();
  await page.getByRole("button", { name: "Paper" }).click();
  for (const pattern of ["lined", "dots", "retro"]) {
    await page.locator(".tool-paper select").selectOption(pattern);
    await expect(page.locator(".journal-page")).toHaveClass(new RegExp(`paper-${pattern}`));
    const layout = await page.locator(".journal-page").evaluate(element => {
      const pageBox = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const inside = (selector: string) => {
        const box = element.querySelector(selector)!.getBoundingClientRect();
        return box.left >= pageBox.left + parseFloat(style.paddingLeft) - 1 && box.right <= pageBox.right - parseFloat(style.paddingRight) + 1;
      };
      const quote = element.querySelector("blockquote")!.getBoundingClientRect();
      const number = element.querySelector(".companion-number")!.getBoundingClientRect();
      return {
        leftInset: parseFloat(style.paddingLeft) / pageBox.width,
        rightInset: parseFloat(style.paddingRight) / pageBox.width,
        topInset: parseFloat(style.paddingTop) / pageBox.width,
        identityInside: inside(".page-identity"),
        dateInside: inside(".date-row"),
        titleInside: inside(".journal-title"),
        quoteInside: inside("blockquote"),
        quoteInsets: [quote.left - pageBox.left, pageBox.right - quote.right],
        numberInset: number.left - pageBox.left,
        padding: [parseFloat(style.paddingLeft), parseFloat(style.paddingRight)],
      };
    });
    const parchment = pattern === "retro";
    expect(layout.leftInset).toBeGreaterThanOrEqual(parchment ? 0.115 : 0.085);
    expect(layout.rightInset).toBeGreaterThanOrEqual(parchment ? 0.125 : 0.115);
    expect(layout.rightInset).toBeGreaterThan(layout.leftInset);
    expect(layout.topInset).toBeGreaterThanOrEqual(parchment ? 0.125 : 0.095);
    expect(layout.identityInside, `${pattern} page identity`).toBe(true);
    expect(layout.dateInside, `${pattern} date heading`).toBe(true);
    expect(layout.titleInside, `${pattern} title`).toBe(true);
    expect(layout.quoteInside, `${pattern} quote ${JSON.stringify(layout)}`).toBe(true);
    expect(layout.numberInset).toBeGreaterThanOrEqual(layout.padding[0] - 1);
  }
});

test("even mobile pages mirror their safe inset toward the right edge", async ({ page }) => {
  await page.getByRole("button", { name: "Open My August Journal" }).click();
  await page.getByRole("button", { name: "New page" }).click();
  await expect(page.locator(".journal-page")).toHaveClass(/side-right/);
  await expect(page.locator(".journal-page .date-row>span")).toBeHidden();
  await page.getByRole("button", { name: "Paper" }).click();

  for (const pattern of ["lined", "dots", "retro"]) {
    await page.locator(".tool-paper select").selectOption(pattern);
    const layout = await page.locator(".journal-page").evaluate(element => {
      const pageBox = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const identity = element.querySelector(".page-identity")!.getBoundingClientRect();
      const title = element.querySelector(".journal-title")!.getBoundingClientRect();
      const quote = element.querySelector("blockquote")!.getBoundingClientRect();
      const number = element.querySelector(".companion-number")!.getBoundingClientRect();
      return {
        pageWidth: pageBox.width,
        left: parseFloat(style.paddingLeft),
        right: parseFloat(style.paddingRight),
        identityInside: identity.left >= pageBox.left + parseFloat(style.paddingLeft) - 1 && identity.right <= pageBox.right - parseFloat(style.paddingRight) + 1,
        titleInside: title.left >= pageBox.left + parseFloat(style.paddingLeft) - 1 && title.right <= pageBox.right - parseFloat(style.paddingRight) + 1,
        quoteInset: pageBox.right - quote.right,
        numberInset: pageBox.right - number.right,
        backgroundImage: style.backgroundImage,
      };
    });
    expect(layout.left / layout.pageWidth, `${pattern} left padding`).toBeLessThanOrEqual(0.065);
    expect(layout.right / layout.pageWidth, `${pattern} right padding`).toBeGreaterThanOrEqual(pattern === "retro" ? 0.185 : 0.145);
    expect(layout.identityInside, `${pattern} page name and date`).toBe(true);
    expect(layout.titleInside, `${pattern} title`).toBe(true);
    expect(layout.quoteInset).toBeGreaterThanOrEqual(layout.right - 1);
    expect(layout.numberInset).toBeGreaterThanOrEqual(layout.right - 1);
    if (pattern === "lined") expect(layout.backgroundImage).toContain("270deg");
  }
});

test("read mode keeps pages navigable and hides editing without losing writing", async ({ page }) => {
  await page.getByRole("button", { name: "Open My August Journal" }).click();
  await page.locator(".journal-page .writing-area textarea").fill("A page to read later");
  const list = page.locator(".journal-page .tiny-list");
  expect(await list.evaluate(element => getComputedStyle(element).transform)).toBe("none");
  expect(await list.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(13);
  await page.getByRole("button", { name: "New page" }).click();
  await page.getByRole("button", { name: "Preview journal" }).click();
  await expect(page.locator(".toolbox")).toBeHidden();
  await expect(page.locator(".journal-page .writing-area textarea")).toHaveCount(0);
  await page.getByRole("button", { name: "Previous page" }).click();
  await expect(page.locator(".journal-page .saved-note")).toContainText("A page to read later");
  await expect(page.locator(".journal-page .tiny-list input").first()).toHaveAttribute("readonly", "");
  await page.getByRole("button", { name: "Exit preview" }).click();
  await expect(page.locator(".journal-page .writing-area textarea")).toHaveValue("A page to read later");
  await expect(page.locator(".toolbox")).toBeVisible();
});

test("desktop read mode keeps the journal visible and its exit control reachable", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: "Open My August Journal" }).click();
  await page.locator(".journal-page .writing-area textarea").fill("A desktop reading page");
  await page.getByRole("button", { name: "Preview journal" }).click();
  await expect(page.locator(".toolbox")).toBeHidden();
  await expect(page.locator(".journal-page .saved-note")).toContainText("A desktop reading page");
  await expect(page.getByRole("button", { name: "Exit preview" })).toBeVisible();
  await page.getByRole("button", { name: "Exit preview" }).click();
  await expect(page.locator(".journal-page .writing-area textarea")).toHaveValue("A desktop reading page");
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

test("photos and stickers can be locked, saved, and unlocked", async ({ page }) => {
  await page.getByRole("button", { name: "Open My August Journal" }).click();
  await page.getByRole("button", { name: "Stickers" }).click();
  await page.locator(".sticker-grid button").first().click();
  await page.getByRole("button", { name: /Lock selected sticker/ }).click();
  const sticker = page.locator(".journal-page .placed-sticker").first();
  await expect(sticker).toHaveClass(/locked/);
  await expect(sticker.locator(".object-lock-marker")).toBeVisible();

  await page.getByRole("button", { name: "Photos" }).click();
  await page.locator('.tool-photos input[type="file"]').setInputFiles({
    name: "memory.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="pink"/></svg>'),
  });
  const photo = page.locator(".journal-page .placed-photo").first();
  await expect(photo).toBeVisible();
  await page.getByRole("button", { name: /Lock selected photo/ }).click();
  await expect(photo).toHaveClass(/locked/);
  await expect(photo.locator(".object-lock-marker")).toBeVisible();
  await page.getByRole("button", { name: /Save journal/ }).click();

  await page.reload();
  await page.getByRole("button", { name: "Open My August Journal" }).click();
  await expect(page.locator(".journal-page .placed-sticker.locked")).toHaveCount(1);
  await expect(page.locator(".journal-page .placed-photo.locked")).toHaveCount(1);
  await page.getByRole("button", { name: "Photos" }).click();
  await page.getByRole("button", { name: "Unlock photo 1" }).click();
  await expect(page.locator(".journal-page .placed-photo.locked")).toHaveCount(0);
  await page.getByRole("button", { name: "Stickers" }).click();
  await page.getByRole("button", { name: "Unlock sticker 1" }).click();
  await expect(page.locator(".journal-page .placed-sticker.locked")).toHaveCount(0);
});

test("list cards and free text boxes can be locked without losing their writing", async ({ page }) => {
  await page.getByRole("button", { name: "Open My August Journal" }).click();
  await page.getByRole("button", { name: "Write", exact: true }).click();
  await page.getByRole("button", { name: "Lock list card" }).click();
  await expect(page.locator(".journal-page .tiny-list.locked")).toBeVisible();
  await page.getByRole("button", { name: "Draw", exact: true }).click();
  await page.getByRole("button", { name: "Free text" }).click();
  const textBox = page.getByRole("textbox", { name: "Free text box" });
  await textBox.fill("A note that stays put");
  await page.getByRole("button", { name: "Lock selected text box" }).click();
  await expect(textBox).toHaveClass(/locked/);
  await page.getByRole("button", { name: "Save journal" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Open My August Journal" }).click();
  await expect(page.locator(".journal-page .tiny-list.locked")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Free text box" })).toHaveClass(/locked/);
  await expect(page.getByRole("textbox", { name: "Free text box" })).toHaveValue("A note that stays put");
  await page.getByRole("button", { name: "Draw", exact: true }).click();
  await page.getByRole("button", { name: "Unlock text box 1" }).click();
  await expect(page.getByRole("textbox", { name: "Free text box" })).not.toHaveClass(/locked/);
});

test("drawing begins immediately after choosing a pen and retains quick strokes", async ({ page }) => {
  await page.getByRole("button", { name: "Open My August Journal" }).click();
  await page.getByRole("button", { name: "Draw", exact: true }).click();
  await page.getByRole("button", { name: "Brush", exact: true }).click();
  await page.locator('.pen-palette button[aria-label^="Ink "]').nth(1).click();
  await expect(page.locator(".journal-page")).toHaveClass(/drawing-mode/);
  await page.getByRole("button", { name: "Draw", exact: true }).click();
  const canvas = page.locator(".journal-page .drawing-canvas");
  await expect(canvas).toHaveCSS("touch-action", "none");
  const before = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.evaluate(y => window.scrollTo(0, y), box!.y + 170);
  const visibleBox = await canvas.boundingBox();
  const x = visibleBox!.x + visibleBox!.width * 0.3;
  const y = visibleBox!.y + 190;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 70, y + 6, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).not.toBe(before);
  const first = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());
  await page.mouse.move(x, y + 30);
  await page.mouse.down();
  await page.mouse.move(x + 70, y + 36, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).not.toBe(first);
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

  await page.getByRole("button", { name: "Paper" }).click();
  await page.getByRole("button", { name: "All pages" }).click();
  await page.getByRole("button", { name: "Midnight black paper" }).click();
  await expect(page.locator(".journal-page")).toHaveClass(/paper-dark/);
  await expect(page.locator(".companion-page")).toHaveClass(/paper-dark/);
  await page.locator(".tool-paper select").selectOption("retro");
  await expect(page.locator(".journal-page")).toHaveClass(/paper-retro/);
  await expect(page.locator(".companion-page")).toHaveClass(/paper-retro/);
  await page.getByRole("button", { name: "Write" }).click();
  await page.locator(".tool-write select").selectOption("ink");
  await expect(page.locator(".journal-page .writing-area")).toHaveClass(/font-ink/);
});

test("mobile page ordering and deletion work without desktop history controls", async ({ page }) => {
  await page.getByRole("button", { name: "Open My August Journal" }).click();
  const title = page.locator(".journal-title");
  await title.fill("A changed title");
  await expect(title).toHaveValue("A changed title");
  await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Redo" })).toHaveCount(0);

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
  page.once("dialog", dialog => dialog.accept("mobile-test-password"));
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
