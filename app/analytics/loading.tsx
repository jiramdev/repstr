export default function AnalyticsLoading() {
  return (
    <div className="min-h-screen bg-[#baa3d0] text-white pb-[calc(8rem+env(safe-area-inset-bottom))] pt-4 px-4 select-none" aria-busy="true">
      <main className="max-w-sm mx-auto space-y-3.5">
        <div className="h-10 w-44 bg-[#141416] rounded-full animate-pulse" />
        <div className="grid grid-cols-2 gap-3.5">
          {[0, 1].map((card) => (
            <div
              key={card}
              className="bg-[#141416] border border-white/[0.08] rounded-[30px] p-5 aspect-square animate-pulse"
            />
          ))}
        </div>
        <section className="bg-[#141416] border border-white/[0.08] rounded-[30px] p-5 space-y-2 animate-pulse">
          {[0, 1, 2].map((row) => (
            <div key={row} className="bg-[#1b1b1e] rounded-2xl px-4 py-3">
              <div className="h-4 w-2/3 bg-white/[0.06] rounded-full" />
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
