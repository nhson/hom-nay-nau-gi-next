"use client";

import { useRouter } from "next/navigation";
import { selectFavorites } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApp } from "../app-provider";

export function FavoritesScreen() {
  const { ready, state, catalog, dispatch } = useApp();
  const router = useRouter();

  if (!ready) return <div aria-busy="true" aria-label="Đang tải" className="h-40 animate-pulse rounded-xl bg-muted" />;

  const rows = selectFavorites(state, catalog);
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border bg-card p-4 text-center text-muted-foreground">
        Chưa có thực đơn yêu thích. Lưu một thực đơn ở tab Hôm nay nhé!
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.id} className="rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold">{row.name}</h3>
            {row.mealType === "buatomonuoc" && <Badge variant="outline">Bữa 1 món</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{row.dishNames.join(" · ")}</p>
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={!row.usable}
              onClick={() => {
                if (dispatch({ type: "use-favorite", id: row.id })?.code === "favorite-applied") router.push("/");
              }}
            >
              Dùng lại
            </Button>
            <Button variant="destructive" onClick={() => dispatch({ type: "delete-favorite", id: row.id })}>
              Xoá
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
