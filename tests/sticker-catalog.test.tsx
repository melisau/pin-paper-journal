import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StickerCatalog } from "@/components/sticker-catalog";

describe("StickerCatalog", () => {
  it("groups a larger quote collection without mixing categories", () => {
    render(<StickerCatalog onAdd={vi.fn()}/>);
    fireEvent.click(screen.getByRole("tab", { name: "Quotes" }));
    expect(screen.getByTitle(/Dream gently/)).toBeInTheDocument();
    expect(screen.getByTitle(/Rest is productive/)).toBeInTheDocument();
    expect(screen.queryByTitle(/Leaf sprig/)).not.toBeInTheDocument();
    expect(screen.getAllByTitle(/drag or tap to add/)).toHaveLength(12);
  });

  it("adds the selected sticker", () => {
    const onAdd = vi.fn();
    render(<StickerCatalog onAdd={onAdd}/>);
    fireEvent.click(screen.getByTitle(/Mushroom/));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ value: "🍄", category: "Botanical" }));
  });

  it("offers twelve distinct washi tapes", () => {
    render(<StickerCatalog onAdd={vi.fn()}/>);
    expect(screen.getByRole("button", { name: "Lavender plaid" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vintage print" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Kraft stripe|Tiny florals|Blush gingham|Sage grid|Powder blue|Butter stripe|Lavender plaid|Rose check|Night stars|Kraft dots|Mint lines|Vintage print/ })).toHaveLength(12);
  });
});
