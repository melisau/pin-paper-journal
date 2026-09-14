import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JournalLibrary, type Book } from "@/components/journal-library";

const books: Book[] = [{ id: "one", title: "My Journal", tone: "rose", label: "notes" }];

function renderLibrary(overrides = {}) {
  const props = { books, onCreate: vi.fn(), onDelete: vi.fn(), onExport: vi.fn(), onImport: vi.fn(), onOpen: vi.fn(), onRename: vi.fn(), onToneChange: vi.fn(), ...overrides };
  render(<JournalLibrary {...props}/>);
  return props;
}

describe("JournalLibrary", () => {
  it("opens and creates journals", () => {
    const props = renderLibrary();
    fireEvent.click(screen.getByRole("button", { name: "Open My Journal" }));
    fireEvent.click(screen.getByRole("button", { name: "New journal" }));
    expect(props.onOpen).toHaveBeenCalledWith("one");
    expect(props.onCreate).toHaveBeenCalledOnce();
  });

  it("renames a journal from the keyboard", () => {
    const props = renderLibrary();
    fireEvent.click(screen.getByRole("button", { name: "Rename My Journal" }));
    const input = screen.getByRole("textbox", { name: "Journal name" });
    fireEvent.change(input, { target: { value: "Travel Notes" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onRename).toHaveBeenCalledWith("one", "Travel Notes");
  });

  it("requests deletion through the parent", () => {
    const props = renderLibrary();
    fireEvent.click(screen.getByRole("button", { name: "Delete My Journal" }));
    expect(props.onDelete).toHaveBeenCalledWith(books[0]);
  });

  it("changes a journal cover colour", () => {
    const props = renderLibrary();
    fireEvent.click(screen.getByRole("button", { name: "Change colour of My Journal" }));
    fireEvent.click(screen.getByRole("button", { name: "Dusty lilac" }));
    expect(props.onToneChange).toHaveBeenCalledWith("one", "lilac");
  });
});
