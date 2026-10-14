import { History } from "lucide-react";
import type { HistoryRow } from "@/domain";

export function HistoryList({ rows }: { rows: HistoryRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="flex items-center gap-3 rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
        <History aria-hidden className="size-5" /> Chưa có lịch sử nấu ăn. Bấm &ldquo;Đã nấu hôm nay&rdquo; sau bữa cơm nhé.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-2xl border bg-card shadow-sm">
      {rows.map((row) => (
        <li key={row.date} className="flex items-start gap-3 px-4 py-3 text-sm">
          <time
            dateTime={row.date}
            className="w-14 shrink-0 rounded-lg bg-muted py-1 text-center font-semibold tabular-nums text-foreground"
          >
            {row.label}
          </time>
          <span className="pt-1 leading-relaxed">
            {row.mealType === "buatomonuoc" && <span aria-label="Bữa 1 món">🍜 </span>}
            {row.names.join(" · ")}
          </span>
        </li>
      ))}
    </ul>
  );
}
