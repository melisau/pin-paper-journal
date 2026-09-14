import { describe, expect, it } from "vitest";
import { moveItem, removeItem } from "@/lib/page-order";

describe("page ordering", () => {
  it("moves a page without mutating the original list", () => {
    const pages = ["one", "two", "three"];
    expect(moveItem(pages, 0, 2)).toEqual(["two", "three", "one"]);
    expect(pages).toEqual(["one", "two", "three"]);
  });

  it("removes only the selected page", () => {
    expect(removeItem(["one", "two", "three"], 1)).toEqual(["one", "three"]);
  });
});
