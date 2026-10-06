export function BrowseMore({ browse }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6" aria-live="polite">
      {browse.error && <p role="alert" className="text-sm text-red-600">{browse.error}</p>}
      {(browse.hasMore || (browse.error && !browse.validationError)) && (
        <button type="button" onClick={browse.loadMore} disabled={browse.loading || browse.loadingMore}
          className="rounded-lg bg-[#008037] px-6 py-3 text-sm font-semibold text-white hover:bg-[#00662c] disabled:opacity-50">
          {browse.loadingMore ? 'Loading…' : browse.error ? 'Try again' : 'Load more'}
        </button>
      )}
    </div>
  );
}
