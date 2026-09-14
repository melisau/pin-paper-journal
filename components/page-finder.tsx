"use client";

import { Plus } from "lucide-react";

export type PageSummary = { id: number; pageName: string; pageDate: string; title: string };

type Props = {
  activeIndex: number;
  onAdd: () => void;
  onSelect: (index: number) => void;
  pages: PageSummary[];
  query: string;
  setQuery: (query: string) => void;
};

export function PageFinder({ activeIndex, onAdd, onSelect, pages, query, setQuery }: Props) {
  const normalizedQuery = query.toLocaleLowerCase();
  const matches = pages.map((page, index) => ({ page, index })).filter(({ page }) =>
    (page.pageName || page.title || "").toLocaleLowerCase().includes(normalizedQuery) || page.pageDate.includes(query),
  );

  return <nav className="page-finder" aria-label="Journal pages">
    <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find by name or date…" aria-label="Search pages"/>
    <div>
      {matches.map(({ page, index }) => <button key={page.id} className={index === activeIndex ? "active" : ""} onClick={() => onSelect(index)}>
        <strong>{page.pageName || `Page ${index + 1}`}</strong><small>{page.pageDate || "No date"}</small>
      </button>)}
      <button onClick={onAdd}><Plus/> New</button>
    </div>
  </nav>;
}
