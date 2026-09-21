"use client";

import type { JournalTemplate } from "@/lib/journal-model";

export function JournalTemplateLayer({ template = "free", checks = [], onToggle, readOnly = false }: { template?: JournalTemplate; checks?: boolean[]; onToggle?: (index: number) => void; readOnly?: boolean }) {
  if (template === "free") return null;
  const count = template === "habit" ? 35 : template === "mood" ? 30 : template === "todo" ? 8 : 7;
  const title = { habit: "Habit tracker", mood: "Mood tracker", weekly: "Weekly plan", todo: "To-do list" }[template];
  return <section className={`journal-template template-${template}`} aria-label={title}>
    <h3>{title}</h3>
    {template === "weekly" ? <div className="weekly-columns">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => <button type="button" key={day} className={checks[index] ? "checked" : ""} disabled={readOnly} onClick={() => onToggle?.(index)}><b>{day}</b><span>{checks[index] ? "planned ✓" : "add plan"}</span></button>)}</div>
      : <div className="tracker-grid">{Array.from({ length: count }, (_, index) => <button type="button" key={index} className={checks[index] ? "checked" : ""} disabled={readOnly} onClick={() => onToggle?.(index)} aria-label={`${title} item ${index + 1}`}>{template === "todo" ? <><i/>{checks[index] ? "completed" : `task ${index + 1}`}</> : index + 1}</button>)}</div>}
  </section>;
}
