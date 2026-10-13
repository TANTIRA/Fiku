import Link from "next/link";
import { currentMonth, monthLabel, shiftMonth, type MonthKey } from "@/lib/dates";

export function MonthNav({ month, basePath, extra }: { month: MonthKey; basePath: string; extra?: string }) {
  const href = (m: MonthKey) => `${basePath}?bulan=${m}${extra ? `&${extra}` : ""}`;
  const isCurrent = month === currentMonth();
  return (
    <div className="flex items-center gap-2">
      <Link href={href(shiftMonth(month, -1))} className="pixel-btn pixel-btn-ghost px-2 py-0.5" aria-label="Bulan sebelumnya">
        ◀
      </Link>
      <span className="min-w-36 text-center font-pixel capitalize">{monthLabel(month)}</span>
      <Link
        href={href(shiftMonth(month, 1))}
        aria-disabled={isCurrent}
        className={`pixel-btn pixel-btn-ghost px-2 py-0.5 ${isCurrent ? "pointer-events-none opacity-40" : ""}`}
        aria-label="Bulan berikutnya"
      >
        ▶
      </Link>
    </div>
  );
}
