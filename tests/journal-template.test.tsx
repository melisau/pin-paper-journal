import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JournalTemplateLayer } from "@/components/journal-template";
import type { TodoItem } from "@/lib/journal-model";

describe("JournalTemplateLayer", () => {
  it("lets the user rename a habit tracker", () => {
    function Example() {
      const [title, setTitle] = useState("Habit tracker");
      return <JournalTemplateLayer template="habit" title={title} onTitleChange={setTitle}/>;
    }
    render(<Example/>);
    fireEvent.change(screen.getByLabelText("Template title"), { target: { value: "Water tracker" } });
    expect(screen.getByLabelText("Template title")).toHaveValue("Water tracker");
  });

  it("starts a to-do list without fake tasks and grows only when requested", () => {
    function Example() {
      const [items, setItems] = useState<TodoItem[]>([]);
      return <JournalTemplateLayer template="todo" todoItems={items} onTodoAdd={() => setItems(current => [...current, { id: 1, text: "", done: false }])} onTodoChange={(id, text) => setItems(current => current.map(item => item.id === id ? { ...item, text } : item))}/>;
    }
    render(<Example/>);
    expect(screen.queryByLabelText("Task text")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    fireEvent.change(screen.getByLabelText("Task text"), { target: { value: "Buy flowers" } });
    expect(screen.getByLabelText("Task text")).toHaveValue("Buy flowers");
  });

  it("renders 31 individually editable mood days", () => {
    render(<JournalTemplateLayer template="mood"/>);
    expect(screen.getByRole("button", { name: "Mood tracker day 31" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Mood tracker day/ })).toHaveLength(31);
  });

  it("accepts short weekly notes instead of check marks", () => {
    function Example() {
      const [notes, setNotes] = useState<string[]>([]);
      return <JournalTemplateLayer template="weekly" weeklyNotes={notes} onWeeklyChange={(index, note) => setNotes(current => { const next = [...current]; next[index] = note; return next; })}/>;
    }
    render(<Example/>);
    fireEvent.change(screen.getByLabelText("Mon note"), { target: { value: "Dentist at 10" } });
    expect(screen.getByLabelText("Mon note")).toHaveValue("Dentist at 10");
    expect(screen.queryByText("planned ✓")).not.toBeInTheDocument();
  });

  it("can render without a template card background", () => {
    render(<JournalTemplateLayer template="habit" backgroundVisible={false}/>);
    expect(screen.getByRole("region", { name: "Habit tracker" })).toHaveClass("template-transparent");
  });
});
