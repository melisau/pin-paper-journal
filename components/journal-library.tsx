"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { BookHeart, Check, ChevronLeft, ChevronRight, CloudUpload, Download, LogOut, Palette, Pencil, Plus, Settings2, Sparkles, Trash2, Upload, X } from "lucide-react";
import type { Book, JournalCover } from "@/lib/journal-model";
import { coverBodyStyle, JOURNAL_COVERS, type CoverChoice } from "@/lib/journal-covers";
import { formatStorage, type StorageUsage } from "@/lib/storage-usage";
import { LanguageSwitcher, useLanguage } from "@/components/language-switcher";
import { LibraryLoadingBooks } from "@/components/library-loading-books";

export type { Book } from "@/lib/journal-model";

const BOOK_TONES = [
  { id: "rose", label: "Blush rose" }, { id: "sage", label: "Soft sage" },
  { id: "blue", label: "Powder blue" }, { id: "butter", label: "Warm butter" },
  { id: "lilac", label: "Dusty lilac" }, { id: "kraft", label: "Craft paper" },
];

function CoverArtwork({ cover, className, sizes }: { cover: CoverChoice; className: string; sizes: string }) {
  const source = `/covers/${cover.id}.png`;
  if (!cover.body) return <Image className={className} src={source} alt="" draggable={false} fill sizes={sizes}/>;
  return <Image className={className} src={source} alt="" draggable={false} width={cover.body.imageWidth} height={cover.body.imageHeight} sizes={sizes} style={coverBodyStyle(cover.body)}/>;
}

type Props = {
  books: Book[]; busy?: boolean; message?: string; onCreate: () => void; onDelete: (book: Book) => void;
  onExport: () => void; onImport: (file: File) => void; onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void; onToneChange: (id: string, tone: string) => void;
  onCoverChange: (id: string, cover?: JournalCover) => void;
  localMigrationCount?: number; migrationBusy?: boolean; migratedLocalCount?: number; onMigrateLocal?: () => void; onRemoveMigratedLocal?: () => void;
  onSignOut?: () => void;
  storageUsage?: StorageUsage | null;
};

export function JournalLibrary({ books, busy = false, message, onCreate, onDelete, onExport, onImport, onOpen, onRename, onToneChange, onCoverChange, localMigrationCount = 0, migrationBusy = false, migratedLocalCount = 0, onMigrateLocal, onRemoveMigratedLocal, onSignOut, storageUsage }: Props) {
  const { language, t } = useLanguage();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [paletteId, setPaletteId] = useState<string | null>(null);
  const [appearanceTab, setAppearanceTab] = useState<"covers" | "colours">("covers");
  const [libraryEditing, setLibraryEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const shelfRef = useRef<HTMLDivElement>(null);
  const shelfDragRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number; moved: boolean } | null>(null);
  const suppressShelfClickRef = useRef(false);
  const [shelfScroll, setShelfScroll] = useState({ left: false, right: false });
  useEffect(() => {
    const shelf = shelfRef.current;
    if (!shelf) return;
    const update = () => {
      const next = { left: shelf.scrollLeft > 2, right: shelf.scrollLeft + shelf.clientWidth < shelf.scrollWidth - 2 };
      setShelfScroll(current => current.left === next.left && current.right === next.right ? current : next);
    };
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(shelf);
    shelf.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { observer?.disconnect(); shelf.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [books.length, libraryEditing]);
  const scrollShelf = (direction: -1 | 1) => {
    const shelf = shelfRef.current;
    if (shelf) shelf.scrollBy({ left: direction * Math.max(230, shelf.clientWidth * 0.7), behavior: "smooth" });
  };
  const startShelfDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const shelf = event.currentTarget;
    suppressShelfClickRef.current = false;
    if (event.pointerType !== "mouse" || event.button !== 0 || window.innerWidth <= 650 || shelf.scrollWidth <= shelf.clientWidth + 1) return;
    if ((event.target as HTMLElement).closest(".book-actions, input")) return;
    shelfDragRef.current = { pointerId: event.pointerId, startX: event.clientX, startScrollLeft: shelf.scrollLeft, moved: false };
  };
  const moveShelfDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = shelfDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(distance) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      suppressShelfClickRef.current = true;
      event.currentTarget.classList.add("is-dragging");
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    event.currentTarget.scrollLeft = drag.startScrollLeft - distance;
  };
  const stopShelfDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (shelfDragRef.current?.pointerId !== event.pointerId) return;
    shelfDragRef.current = null;
    if (event.type === "pointercancel") suppressShelfClickRef.current = false;
    event.currentTarget.classList.remove("is-dragging");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const beginRename = (book: Book) => { setEditingId(book.id); setPaletteId(null); setDraft(book.title); };
  const finishRename = () => { if (editingId && draft.trim()) onRename(editingId, draft.trim()); setEditingId(null); };
  const toggleLibraryEditing = () => { setLibraryEditing(current => !current); setEditingId(null); setPaletteId(null); };
  const selectedBook = books.find(book => book.id === paletteId);

  return <main className={`library-screen ${libraryEditing ? "editing-library" : ""}`}>
    <div className="library-copy"><LanguageSwitcher/><span className="eyebrow">PIN & PAPER</span><h1>{t("Your little corner")}<br/>{t("of memories")}</h1><p>{t("Thoughts, photos and little joys — all in one place.")}</p>
      <div className="backup-actions"><button onClick={onExport} aria-label={t("Export backup")}><Download/><span className="backup-action-text"><span>{language === "tr" ? "Yedeği" : "Export"}</span><span>{language === "tr" ? "dışa aktar" : "backup"}</span></span></button><label aria-label={t("Import backup")}><Upload/><span className="backup-action-text"><span>{language === "tr" ? "Yedeği" : "Import"}</span><span>{language === "tr" ? "içe aktar" : "backup"}</span></span><input type="file" accept="application/json,.json" onChange={event => { const file=event.target.files?.[0]; if(file)onImport(file); event.target.value=""; }}/></label>{books.length > 0 && <button className={libraryEditing ? "active" : ""} onClick={toggleLibraryEditing} aria-label={t(libraryEditing ? "Done" : "Edit library")}>{libraryEditing ? <Check/> : <Settings2/>}<span className="backup-action-text">{libraryEditing ? t("Done") : <><span>{language === "tr" ? "Kütüphaneyi" : "Edit"}</span><span>{language === "tr" ? "düzenle" : "library"}</span></>}</span></button>}{onSignOut&&<button onClick={onSignOut} disabled={busy}><LogOut/> {t("Sign out")}</button>}</div>
    </div>
    {storageUsage && <section className="storage-usage" aria-label={t("Encrypted photo storage usage")}>
      <div><strong>{t("Encrypted storage")}</strong><span>{formatStorage(storageUsage.usedBytes)} {t("of")} {formatStorage(storageUsage.quotaBytes)}</span></div>
      <progress value={storageUsage.usedBytes} max={storageUsage.quotaBytes}/>
    </section>}
    {localMigrationCount > 0 && <section className="migration-card">
      <span><CloudUpload/></span><div><strong>{t("Bring your local journals with you")}</strong><p>{language === "tr" ? `${localMigrationCount} defter şifrelenip özel bulut rafına taşınmaya hazır. Önce bir yedek indirilir; yerel kopyalar korunur.` : `${localMigrationCount} ${localMigrationCount === 1 ? "journal is" : "journals are"} ready to encrypt and move to your private cloud shelf. A backup downloads first, and the local copies stay untouched.`}</p></div>
      <button onClick={onMigrateLocal} disabled={migrationBusy}>{t(migrationBusy ? "Encrypting & moving…" : "Back up & move to cloud")}</button>
    </section>}
    {migratedLocalCount > 0 && <section className="migration-card">
      <span><Check/></span><div><strong>{t("Your cloud copies are ready")}</strong><p>{language === "tr" ? `Orijinal ${migratedLocalCount} yerel defter hâlâ bu cihazda. Yalnızca ek kopyaya ihtiyacın yoksa kaldır.` : `The original local ${migratedLocalCount === 1 ? "journal is" : "journals are"} still on this device. Remove them only if you no longer need the extra local copy.`}</p></div>
      <button onClick={onRemoveMigratedLocal}>{t(migratedLocalCount === 1 ? "Remove local copy" : "Remove local copies")}</button>
    </section>}
    {message && <p className="library-notice" role="status"><Sparkles/>{t(message)}</p>}
    <div className="shelf-scene" aria-busy={busy}><div className="shelf-track">
      {shelfScroll.left && <button className="shelf-scroll-button shelf-scroll-left" onClick={() => scrollShelf(-1)} aria-label={t("Scroll journals left")}><ChevronLeft/></button>}
      <div className={`books-row ${shelfScroll.left || shelfScroll.right ? "draggable-shelf" : ""}`} ref={shelfRef} onPointerDown={startShelfDrag} onPointerMove={moveShelfDrag} onPointerUp={stopShelfDrag} onPointerCancel={stopShelfDrag} onClickCapture={event => { if (!suppressShelfClickRef.current) return; event.preventDefault(); event.stopPropagation(); suppressShelfClickRef.current = false; }} onDragStart={event => event.preventDefault()}>
      {books.length === 0 ? busy ? <LibraryLoadingBooks label={t("Preparing your journals")}/> : <section className="empty-library" role="status">
        <span className="empty-book"><BookHeart/></span><span className="empty-sparkle">✦</span>
        <p className="empty-kicker">{t("YOUR STORY STARTS HERE")}</p>
        <h2>{t("A blank shelf, ready for you")}</h2>
        <p>{t("Make a private little home for thoughts, photographs and everyday magic.")}</p>
        <button onClick={onCreate}><Plus/> {t("Create my first journal")}</button>
      </section> : <>
        {books.map((book, index) => <article key={book.id} className="book-card">
          <button className={`book-cover ${book.tone} ${book.cover ? "preset-cover" : ""} ${book.cover && JOURNAL_COVERS.find(choice => choice.id === book.cover)?.body ? "normalized-cover" : ""}`} style={{ "--tilt": `${index % 2 ? 2 : -2}deg` } as React.CSSProperties} onClick={() => onOpen(book.id)} aria-label={`${t("Open")} ${t(book.title)}`}>
            {book.cover && <CoverArtwork cover={JOURNAL_COVERS.find(choice => choice.id === book.cover) ?? JOURNAL_COVERS[0]} className="book-cover-art" sizes="(max-width: 650px) 170px, 190px"/>}
            <span className="book-band">{t(book.label)}</span><i>✦</i><strong>{t(book.title)}</strong><small>2026</small>
          </button>
          {libraryEditing && <div className="book-actions">
            {editingId === book.id ? <>
              <input autoFocus value={draft} maxLength={60} aria-label={t("Journal name")} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter") finishRename(); if (event.key === "Escape") setEditingId(null); }}/>
              <button onClick={finishRename} aria-label={t("Save journal name")}><Check/></button><button onClick={() => setEditingId(null)} aria-label={t("Cancel rename")}><X/></button>
            </> : <><button onClick={() => beginRename(book)} aria-label={`${t("Rename")} ${t(book.title)}`}><Pencil/></button><button className="appearance-action" onClick={() => { setPaletteId(paletteId === book.id ? null : book.id); setAppearanceTab("covers"); }} aria-label={`${t("Choose journal appearance for")} ${t(book.title)}`} aria-expanded={paletteId === book.id}><Palette/><span>{t("Appearance")}</span></button><button onClick={() => onDelete(book)} aria-label={`${t("Delete")} ${t(book.title)}`}><Trash2/></button></>}
          </div>}
        </article>)}
        <button className="new-journal-card" onClick={onCreate} aria-label={t("New journal")} disabled={busy}><span className="new-journal-icon"><Plus/></span><strong>{t(busy ? "Please wait…" : "New journal")}</strong><span className="new-journal-caption">{t("make it yours")}</span></button>
      </>}
      </div>
      {shelfScroll.right && <button className="shelf-scroll-button shelf-scroll-right" onClick={() => scrollShelf(1)} aria-label={t("Scroll journals right")}><ChevronRight/></button>}
    </div><div className="wood-shelf"/></div><p className="library-hint">{t("Choose a journal to begin")}</p>
    {libraryEditing && selectedBook && <div className="appearance-backdrop" onClick={() => setPaletteId(null)}>
      <section className="appearance-picker" role="dialog" aria-modal="true" aria-label={`${t("Choose journal appearance for")} ${t(selectedBook.title)}`} onClick={event => event.stopPropagation()}>
        <div className="appearance-picker-heading"><div><span className="eyebrow">PIN & PAPER</span><h2>{t("Choose journal appearance")}</h2><p>{t("Change only the cover; your pages stay as they are.")}</p></div><button className="appearance-close" onClick={() => setPaletteId(null)} aria-label={t("Close")}><X/></button></div>
        <div className="appearance-tabs" role="tablist" aria-label={t("Appearance type")}>{(["covers", "colours"] as const).map(tab => <button key={tab} role="tab" aria-selected={appearanceTab === tab} onClick={() => setAppearanceTab(tab)}>{tab === "covers" ? t("Ready-made journals") : t("Cover colours")}</button>)}</div>
        {appearanceTab === "covers" ? <div className="appearance-covers">
          {JOURNAL_COVERS.map(cover => <button key={cover.id} className={`appearance-cover-option ${selectedBook.cover === cover.id ? "selected" : ""}`} onClick={() => { onCoverChange(selectedBook.id, cover.id); setPaletteId(null); }} aria-label={t(cover.label)} aria-pressed={selectedBook.cover === cover.id}><span className="appearance-cover-frame"><span className="appearance-cover-body"><CoverArtwork cover={cover} className="appearance-cover-art" sizes="(max-width: 500px) 95px, 88px"/></span></span><span>{t(cover.label)}</span>{selectedBook.cover === cover.id && <Check className="appearance-check"/>}</button>)}
          {selectedBook.cover && <button className="appearance-remove-cover" onClick={() => { onCoverChange(selectedBook.id, undefined); setPaletteId(null); }}>{t("Use a plain colour cover")}</button>}
        </div> : <div className="appearance-colours">{BOOK_TONES.map(tone => <button key={tone.id} className={`appearance-colour-option ${tone.id} ${selectedBook.tone === tone.id && !selectedBook.cover ? "selected" : ""}`} onClick={() => { onToneChange(selectedBook.id, tone.id); setPaletteId(null); }} aria-label={t(tone.label)}><span>{selectedBook.tone === tone.id && !selectedBook.cover && <Check/>}</span>{t(tone.label)}</button>)}</div>}
      </section>
    </div>}
  </main>;
}
