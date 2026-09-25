"use client";

import { useState } from "react";
import { BookHeart, Check, CloudUpload, Download, LogOut, Palette, Pencil, Plus, Settings2, Sparkles, Trash2, Upload, X } from "lucide-react";
import type { Book } from "@/lib/journal-model";
import { formatStorage, type StorageUsage } from "@/lib/storage-usage";

export type { Book } from "@/lib/journal-model";

const BOOK_TONES = [
  { id: "rose", label: "Blush rose" }, { id: "sage", label: "Soft sage" },
  { id: "blue", label: "Powder blue" }, { id: "butter", label: "Warm butter" },
  { id: "lilac", label: "Dusty lilac" }, { id: "kraft", label: "Craft paper" },
];

type Props = {
  books: Book[]; busy?: boolean; message?: string; onCreate: () => void; onDelete: (book: Book) => void;
  onExport: () => void; onImport: (file: File) => void; onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void; onToneChange: (id: string, tone: string) => void;
  localMigrationCount?: number; migrationBusy?: boolean; migratedLocalCount?: number; onMigrateLocal?: () => void; onRemoveMigratedLocal?: () => void;
  onSignOut?: () => void;
  storageUsage?: StorageUsage | null;
};

export function JournalLibrary({ books, busy = false, message, onCreate, onDelete, onExport, onImport, onOpen, onRename, onToneChange, localMigrationCount = 0, migrationBusy = false, migratedLocalCount = 0, onMigrateLocal, onRemoveMigratedLocal, onSignOut, storageUsage }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [paletteId, setPaletteId] = useState<string | null>(null);
  const [libraryEditing, setLibraryEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const beginRename = (book: Book) => { setEditingId(book.id); setPaletteId(null); setDraft(book.title); };
  const finishRename = () => { if (editingId && draft.trim()) onRename(editingId, draft.trim()); setEditingId(null); };
  const toggleLibraryEditing = () => { setLibraryEditing(current => !current); setEditingId(null); setPaletteId(null); };

  return <main className={`library-screen ${libraryEditing ? "editing-library" : ""}`}>
    <div className="library-copy"><span className="eyebrow">PIN & PAPER</span><h1>Your little corner<br/>of memories</h1><p>Thoughts, photos and little joys — all in one place.</p>
      <div className="backup-actions"><button onClick={onExport}><Download/> Export backup</button><label><Upload/> Import backup<input type="file" accept="application/json,.json" onChange={event => { const file=event.target.files?.[0]; if(file)onImport(file); event.target.value=""; }}/></label>{books.length > 0 && <button className={libraryEditing ? "active" : ""} onClick={toggleLibraryEditing}>{libraryEditing ? <Check/> : <Settings2/>}{libraryEditing ? "Done" : "Edit library"}</button>}{onSignOut&&<button onClick={onSignOut} disabled={busy}><LogOut/> Sign out</button>}</div>
    </div>
    {storageUsage && <section className="storage-usage" aria-label="Encrypted photo storage usage">
      <div><strong>Encrypted storage</strong><span>{formatStorage(storageUsage.usedBytes)} of {formatStorage(storageUsage.quotaBytes)}</span></div>
      <progress value={storageUsage.usedBytes} max={storageUsage.quotaBytes}/>
    </section>}
    {localMigrationCount > 0 && <section className="migration-card">
      <span><CloudUpload/></span><div><strong>Bring your local journals with you</strong><p>{localMigrationCount} {localMigrationCount === 1 ? "journal is" : "journals are"} ready to encrypt and move to your private cloud shelf. A backup downloads first, and the local copies stay untouched.</p></div>
      <button onClick={onMigrateLocal} disabled={migrationBusy}>{migrationBusy ? "Encrypting & moving…" : "Back up & move to cloud"}</button>
    </section>}
    {migratedLocalCount > 0 && <section className="migration-card">
      <span><Check/></span><div><strong>Your cloud copies are ready</strong><p>The original local {migratedLocalCount === 1 ? "journal is" : "journals are"} still on this device. Remove them only if you no longer need the extra local copy.</p></div>
      <button onClick={onRemoveMigratedLocal}>Remove local {migratedLocalCount === 1 ? "copy" : "copies"}</button>
    </section>}
    {message && <p className="library-notice" role="status"><Sparkles/>{message}</p>}
    <div className="shelf-scene" aria-busy={busy}><div className="books-row">
      {books.length === 0 ? !busy && <section className="empty-library" role="status">
        <span className="empty-book"><BookHeart/></span><span className="empty-sparkle">✦</span>
        <p className="empty-kicker">YOUR STORY STARTS HERE</p>
        <h2>A blank shelf, ready for you</h2>
        <p>Make a private little home for thoughts, photographs and everyday magic.</p>
        <button onClick={onCreate}><Plus/> Create my first journal</button>
      </section> : <>
        {books.map((book, index) => <article key={book.id} className="book-card">
          <button className={`book-cover ${book.tone}`} style={{ "--tilt": `${index % 2 ? 2 : -2}deg` } as React.CSSProperties} onClick={() => onOpen(book.id)} aria-label={`Open ${book.title}`}>
            <span className="book-band">{book.label}</span><i>✦</i><strong>{book.title}</strong><small>2026</small>
          </button>
          {libraryEditing && <div className="book-actions">
            {editingId === book.id ? <>
              <input autoFocus value={draft} maxLength={60} aria-label="Journal name" onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter") finishRename(); if (event.key === "Escape") setEditingId(null); }}/>
              <button onClick={finishRename} aria-label="Save journal name"><Check/></button><button onClick={() => setEditingId(null)} aria-label="Cancel rename"><X/></button>
            </> : <><button onClick={() => beginRename(book)} aria-label={`Rename ${book.title}`}><Pencil/></button><button onClick={() => setPaletteId(paletteId === book.id ? null : book.id)} aria-label={`Change colour of ${book.title}`} aria-expanded={paletteId === book.id}><Palette/></button><button onClick={() => onDelete(book)} aria-label={`Delete ${book.title}`}><Trash2/></button></>}
          </div>}
          {libraryEditing && paletteId === book.id && <div className="book-palette" aria-label={`Colours for ${book.title}`}>
            {BOOK_TONES.map(tone => <button key={tone.id} className={`${tone.id} ${book.tone === tone.id ? "selected" : ""}`} onClick={() => { onToneChange(book.id, tone.id); setPaletteId(null); }} aria-label={tone.label} title={tone.label}>{book.tone === tone.id && <Check/>}</button>)}
          </div>}
        </article>)}
        <button className="book-cover kraft new-book" onClick={onCreate} aria-label="New journal" disabled={busy}><Plus/><strong>{busy ? "Please wait…" : "New journal"}</strong><small>make it yours</small></button>
      </>}
    </div><div className="wood-shelf"/></div><p className="library-hint">Choose a journal to begin</p>
  </main>;
}
