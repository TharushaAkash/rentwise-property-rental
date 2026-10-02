export function PageLoading({ fullPage = false }) {
  return (
    <div role="status" aria-label="Loading page" className={fullPage ? 'min-h-screen bg-slate-50 px-6 py-12 sm:px-12' : 'py-8'}>
      <span className="sr-only">Loading page, please wait.</span>
      <div aria-hidden="true" className="mx-auto max-w-6xl space-y-8 motion-safe:animate-pulse">
        {fullPage && <div className="mb-12 text-xl font-semibold tracking-tight text-slate-800">RentWise</div>}
        <div className="space-y-3">
          <div className="h-8 w-48 rounded-lg bg-slate-200" />
          <div className="h-4 w-64 max-w-full rounded bg-slate-200/70" />
        </div>
        <div className="h-12 rounded-xl border border-slate-200 bg-white" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map(item => (
            <div key={item} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="h-40 bg-slate-200/60" />
              <div className="space-y-3 p-5">
                <div className="h-5 w-3/4 rounded bg-slate-200" />
                <div className="h-3 w-full rounded bg-slate-100" />
                <div className="h-3 w-1/2 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
