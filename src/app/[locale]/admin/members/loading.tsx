export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-7 w-40 bg-ink-100 rounded-lg" />
          <div className="h-4 w-20 bg-ink-100 rounded mt-2" />
        </div>
        <div className="h-9 w-28 bg-ink-100 rounded-lg" />
      </div>
      <div className="bg-white border border-ink-100 rounded-2xl overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-6 px-5 py-4 border-b border-ink-50">
            <div className="h-4 w-36 bg-ink-100 rounded" />
            <div className="h-4 w-24 bg-ink-100 rounded" />
            <div className="h-4 w-24 bg-ink-100 rounded" />
            <div className="h-4 w-16 bg-ink-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
