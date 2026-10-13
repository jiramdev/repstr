export default function ScheduleLoading() {
  return (
    <div className="min-h-screen bg-[#baa3d0] text-white pb-[calc(8rem+env(safe-area-inset-bottom))] pt-4 px-4 select-none" aria-busy="true">
      <main className="max-w-sm mx-auto space-y-3.5">
        <div className="h-10 w-56 bg-[#141416] rounded-full animate-pulse" />
        <section className="bg-[#141416] border border-white/[0.08] rounded-[30px] px-2 py-3 animate-pulse">
          <div className="grid grid-cols-4 gap-2 px-2 pt-2">
            {[0, 1, 2, 3, 4, 5, 6].map((day) => (
              <div key={day} className="aspect-square rounded-2xl bg-[#1b1b1e]" />
            ))}
          </div>
        </section>
        <section className="bg-[#141416] border border-white/[0.08] rounded-[30px] p-5 space-y-2 animate-pulse">
          {[0, 1].map((row) => (
            <div key={row} className="bg-[#1b1b1e] rounded-2xl px-4 py-3">
              <div className="h-4 w-1/2 bg-white/[0.06] rounded-full" />
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
