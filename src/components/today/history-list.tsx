import type { HistoryRow } from "@/domain";

export function HistoryList({ rows }: { rows: HistoryRow[] }) {
  if (rows.length === 0) {
    return <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Chưa có lịch sử nấu ăn.</p>;
  }

  return (
    <ul className="divide-y rounded-xl border bg-card">
      {rows.map((row) => (
        <li key={row.date} className="flex gap-3 px-4 py-3 text-sm">
          <time dateTime={row.date} className="w-12 shrink-0 font-semibold tabular-nums text-muted-foreground">
            {row.label}
          </time>
          <span>
            {row.mealType === "buatomonuoc" && <span aria-label="Bữa 1 món">🍜 </span>}
            {row.names.join(" · ")}
          </span>
        </li>
      ))}
    </ul>
  );
}
