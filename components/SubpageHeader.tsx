import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function SubpageHeader({ title, href }: { title: string; href: string }) {
  return (
    <header className="flex items-center justify-between px-1 py-1">
      <Link
        href={href}
        prefetch={true}
        aria-label="Back"
        className="w-10 h-10 rounded-full bg-[#141416] border border-white/[0.08] flex items-center justify-center text-white apple-press shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
      >
        <ChevronLeft className="w-5 h-5 stroke-[1.8]" />
      </Link>
      <div className="h-10 bg-[#141416] border border-white/[0.08] px-4 rounded-full flex items-center gap-2 shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
        <span className="w-2 h-2 rounded-full bg-[#baa3d0]" />
        <span className="font-editorial text-[14px] tracking-wider text-white leading-none uppercase">
          {title}
        </span>
      </div>
    </header>
  );
}
