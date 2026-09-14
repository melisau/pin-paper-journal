import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PageFinder } from "@/components/page-finder";

const pages = [
  { id: 1, pageName: "Today", pageDate: "2026-09-13", title: "Morning" },
  { id: 2, pageName: "Dreams", pageDate: "2026-09-14", title: "Night" },
];

describe("PageFinder", () => {
  it("filters and selects a page", () => {
    const onSelect = vi.fn();
    const setQuery = vi.fn();
    const { rerender } = render(<PageFinder activeIndex={0} onAdd={vi.fn()} onSelect={onSelect} pages={pages} query="" setQuery={setQuery}/>);
    fireEvent.change(screen.getByRole("textbox", { name: "Search pages" }), { target: { value: "dream" } });
    expect(setQuery).toHaveBeenCalledWith("dream");
    rerender(<PageFinder activeIndex={0} onAdd={vi.fn()} onSelect={onSelect} pages={pages} query="dream" setQuery={setQuery}/>);
    expect(screen.queryByRole("button", { name: /Today/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Dreams/ }));
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});
