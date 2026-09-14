"use client";

import { useState } from "react";
import { BookHeart, Check, Download, Palette, Pencil, Plus, Sparkles, Trash2, Upload, X } from "lucide-react";

export type Book = { id: string; title: string; tone: string; label: string };

const BOOK_TONES = [
  { id: "rose", label: "Blush rose" }, { id: "sage", label: "Soft sage" },
  { id: "blue", label: "Powder blue" }, { id: "butter", label: "Warm butter" },
  { id: "lilac", label: "Dusty lilac" }, { id: "kraft", label: "Craft paper" },
];

type Props = {
  books: Book[]; busy?: boolean; message?: string; onCreate: () => void; onDelete: (book: Book) => void;
  onExport: () => void; onImport: (file: File) => void; onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void; onToneChange: (id: string, tone: string) => void;
};

export function JournalLibrary({ books, busy = false, message, onCreate, onDelete, onExport, onImport, onOpen, onRename, onToneChange }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [paletteId, setPaletteId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const beginRename = (book: Book) => { setEditingId(book.id); setPaletteId(null); setDraft(book.title); };
  const finishRename = () => { if (editingId && draft.trim()) onRename(editingId, draft.trim()); setEditingId(null); };

  return <main className="library-screen">
    <div className="library-copy"><span className="eyebrow">PIN & PAPER</span><h1>Your little corner<br/>of memories</h1><p>Thoughts, photos and little joys — all in one place.</p>
      <div className="backup-actions"><button onClick={onExport}><Download/> Export backup</button><label><Upload/> Import backup<input type="file" accept="application/json,.json" onChange={event => { const file=event.target.files?.[0]; if(file)onImport(file); event.target.value=""; }}/></label></div>
    </div>
    {message && books.length > 0 && <p className="library-notice" role="status"><Sparkles/>{message}</p>}
    <div className="shelf-scene" aria-busy={busy}><div className="books-row">
      {books.length === 0 ? <section className="empty-library" role="status">
        <span className="empty-book"><BookHeart/></span><span className="empty-sparkle">✦</span>
        <p className="empty-kicker">YOUR STORY STARTS HERE</p>
        <h2>{busy ? "Opening your shelf…" : "A blank shelf, ready for you"}</h2>
        <p>{busy ? "Unlocking your encrypted journals." : "Make a private little home for thoughts, photographs and everyday magic."}</p>
        {!busy && <button onClick={onCreate}><Plus/> Create my first journal</button>}
      </section> : <>
        {books.map((book, index) => <article key={book.id} className="book-card">
          <button className={`book-cover ${book.tone}`} style={{ "--tilt": `${index % 2 ? 2 : -2}deg` } as React.CSSProperties} onClick={() => onOpen(book.id)} aria-label={`Open ${book.title}`}>
            <span className="book-band">{book.label}</span><i>✦</i><strong>{book.title}</strong><small>2026</small>
          </button>
          <div className="book-actions">
            {editingId === book.id ? <>
              <input autoFocus value={draft} maxLength={60} aria-label="Journal name" onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter") finishRename(); if (event.key === "Escape") setEditingId(null); }}/>
              <button onClick={finishRename} aria-label="Save journal name"><Check/></button><button onClick={() => setEditingId(null)} aria-label="Cancel rename"><X/></button>
            </> : <><button onClick={() => beginRename(book)} aria-label={`Rename ${book.title}`}><Pencil/></button><button onClick={() => setPaletteId(paletteId === book.id ? null : book.id)} aria-label={`Change colour of ${book.title}`} aria-expanded={paletteId === book.id}><Palette/></button><button onClick={() => onDelete(book)} aria-label={`Delete ${book.title}`}><Trash2/></button></>}
          </div>
          {paletteId === book.id && <div className="book-palette" aria-label={`Colours for ${book.title}`}>
            {BOOK_TONES.map(tone => <button key={tone.id} className={`${tone.id} ${book.tone === tone.id ? "selected" : ""}`} onClick={() => { onToneChange(book.id, tone.id); setPaletteId(null); }} aria-label={tone.label} title={tone.label}>{book.tone === tone.id && <Check/>}</button>)}
          </div>}
        </article>)}
        <button className="book-cover kraft new-book" onClick={onCreate} aria-label="New journal" disabled={busy}><Plus/><strong>{busy ? "Please wait…" : "New journal"}</strong><small>make it yours</small></button>
      </>}
    </div><div className="wood-shelf"/></div><p className="library-hint">Choose a journal to begin</p>
  </main>;
}
