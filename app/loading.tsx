export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-[#baa3d0] text-white pb-[calc(8rem+env(safe-area-inset-bottom))] pt-4 px-4 select-none" aria-busy="true">
      <main className="max-w-sm mx-auto space-y-3.5">
        <div className="h-10 w-40 bg-[#141416] rounded-full animate-pulse" />
        <section className="bg-[#141416] border border-white/[0.08] rounded-[34px] px-6 py-8 animate-pulse">
          <div className="h-8 w-2/3 bg-white/[0.06] rounded-full" />
          <div className="mt-3 h-4 w-1/2 bg-white/[0.04] rounded-full" />
        </section>
        <div className="grid grid-cols-2 gap-3.5">
          {[0, 1].map((card) => (
            <div
              key={card}
              className="bg-[#141416] border border-white/[0.08] rounded-[30px] p-5 aspect-square animate-pulse"
            >
              <div className="h-3 w-16 bg-white/[0.06] rounded-full mx-auto" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
