export default function AccountLoading() {
  return (
    <div className="min-h-screen bg-[#baa3d0] text-white pb-32 pt-4 px-4 select-none" aria-busy="true">
      <main className="max-w-sm mx-auto space-y-3.5">
        <section className="bg-[#141416] border border-white/[0.08] rounded-[34px] px-6 py-8 animate-pulse">
          <div className="h-8 w-1/2 bg-white/[0.06] rounded-full mx-auto" />
          <div className="mt-3 h-4 w-2/3 bg-white/[0.04] rounded-full mx-auto" />
        </section>
        <section className="bg-[#141416] border border-white/[0.08] rounded-[30px] p-5 space-y-2 animate-pulse">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-12 bg-[#1b1b1e] rounded-2xl" />
          ))}
        </section>
      </main>
    </div>
  );
}
