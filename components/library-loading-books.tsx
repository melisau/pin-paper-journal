export function LibraryLoadingBooks({ label }: { label: string }) {
  return <div className="library-loading-books" role="status" aria-label={label}>
    <span className="library-loading-book"/><span className="library-loading-book"/><span className="library-loading-book"/>
  </div>;
}
