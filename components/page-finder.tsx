"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";

export type PageSummary = { id: string | number; pageName: string; pageDate: string; title: string };

type Props = {
  activeIndex: number;
  onAdd: () => void;
  onSelect: (index: number) => void;
  pages: PageSummary[];
  query: string;
  setQuery: (query: string) => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onDelete?: () => void;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
};

export function PageFinder({ activeIndex, onAdd, onSelect, pages, query, setQuery, onMoveLeft, onMoveRight, onDelete, canMoveLeft, canMoveRight }: Props) {
  const activePageRef = useRef<HTMLButtonElement>(null);
  const normalizedQuery = query.toLocaleLowerCase();
  const matches = pages.map((page, index) => ({ page, index })).filter(({ page }) =>
    (page.pageName || page.title || "").toLocaleLowerCase().includes(normalizedQuery) || page.pageDate.includes(query),
  );
  useEffect(() => {
    if (typeof activePageRef.current?.scrollIntoView === "function") activePageRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeIndex]);

  return <nav className="page-finder" aria-label="Journal pages">
    <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find by name or date…" aria-label="Search pages"/>
    <div>
      {matches.map(({ page, index }) => <button ref={index === activeIndex ? activePageRef : undefined} key={page.id} className={index === activeIndex ? "active" : ""} onClick={() => onSelect(index)}>
        <strong>{page.pageName || `Page ${index + 1}`}</strong><small>{page.pageDate || "No date"}</small>
      </button>)}
      <button onClick={onAdd}><Plus/> New</button>
    </div>
    <div className="mobile-page-actions">
      <button disabled={!canMoveLeft} onClick={onMoveLeft} aria-label="Move page left"><ArrowLeft/> Move left</button>
      <button disabled={!canMoveRight} onClick={onMoveRight} aria-label="Move page right"><ArrowRight/> Move right</button>
      <button onClick={onDelete} aria-label="Delete page"><Trash2/> Delete</button>
    </div>
  </nav>;
}
