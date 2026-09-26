import { LibraryLoadingBooks } from "@/components/library-loading-books";

export default function JournalLoading() {
  return <main className="library-screen library-loading-page" aria-busy="true">
    <div className="library-copy"><span className="eyebrow">PIN & PAPER</span></div>
    <div className="shelf-scene"><div className="books-row"><LibraryLoadingBooks label="Defterler hazırlanıyor / Preparing journals"/></div><div className="wood-shelf"/></div>
  </main>;
}
