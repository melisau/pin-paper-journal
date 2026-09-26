import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JournalLibrary, type Book } from "@/components/journal-library";

const books: Book[] = [{ id: "one", title: "My Journal", tone: "rose", label: "notes" }];

function renderLibrary(overrides = {}) {
  const props = { books, onCreate: vi.fn(), onDelete: vi.fn(), onExport: vi.fn(), onImport: vi.fn(), onOpen: vi.fn(), onRename: vi.fn(), onToneChange: vi.fn(), onCoverChange: vi.fn(), ...overrides };
  render(<JournalLibrary {...props}/>);
  return props;
}

describe("JournalLibrary", () => {
  it("opens and creates journals", () => {
    const props = renderLibrary();
    fireEvent.click(screen.getByRole("button", { name: "Open My Journal" }));
    const newJournal = screen.getByRole("button", { name: "New journal" });
    expect(newJournal).toHaveClass("new-journal-card");
    fireEvent.click(newJournal);
    expect(props.onOpen).toHaveBeenCalledWith("one");
    expect(props.onCreate).toHaveBeenCalledOnce();
  });

  it("renames a journal from the keyboard", () => {
    const props = renderLibrary();
    fireEvent.click(screen.getByRole("button", { name: "Edit library" }));
    fireEvent.click(screen.getByRole("button", { name: "Rename My Journal" }));
    const input = screen.getByRole("textbox", { name: "Journal name" });
    fireEvent.change(input, { target: { value: "Travel Notes" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onRename).toHaveBeenCalledWith("one", "Travel Notes");
  });

  it("requests deletion through the parent", () => {
    const props = renderLibrary();
    fireEvent.click(screen.getByRole("button", { name: "Edit library" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete My Journal" }));
    expect(props.onDelete).toHaveBeenCalledWith(books[0]);
  });

  it("changes a journal cover colour", () => {
    const props = renderLibrary();
    expect(screen.queryByRole("button", { name: "Choose journal appearance for My Journal" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit library" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose journal appearance for My Journal" }));
    fireEvent.click(screen.getByRole("tab", { name: "Cover colours" }));
    fireEvent.click(screen.getByRole("button", { name: "Dusty lilac" }));
    expect(props.onToneChange).toHaveBeenCalledWith("one", "lilac");
  });

  it("offers thirteen equally framed ready-made journals", () => {
    const props = renderLibrary();
    fireEvent.click(screen.getByRole("button", { name: "Edit library" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose journal appearance for My Journal" }));
    expect(document.querySelectorAll(".appearance-cover-frame")).toHaveLength(13);
    fireEvent.click(screen.getByRole("button", { name: "Pastel pink linen" }));
    expect(props.onCoverChange).toHaveBeenCalledWith("one", "journal-10");
  });

  it("hides editing controls again when done", () => {
    renderLibrary();
    fireEvent.click(screen.getByRole("button", { name: "Edit library" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("button", { name: "Rename My Journal" })).not.toBeInTheDocument();
  });

  it("shows cloud errors even when the shelf is empty", () => {
    renderLibrary({ books: [], message: "Your encryption key is locked." });
    expect(screen.getByText("Your encryption key is locked.")).toBeInTheDocument();
  });

  it("shows shelf placeholders while encrypted covers load", () => {
    renderLibrary({ books: [], busy: true });
    expect(screen.getByRole("status", { name: "Preparing your journals" })).toBeInTheDocument();
    expect(screen.queryByText("A blank shelf, ready for you")).not.toBeInTheDocument();
  });
});
