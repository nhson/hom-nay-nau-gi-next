import type { Dish } from "@/domain";

/** Ingredients and numbered steps of one dish, shared by the menu card and the dish bank. */
export function Recipe({ dish }: { dish: Pick<Dish, "ingredients" | "steps"> }) {
  return (
    <div className="space-y-5">
      <section>
        <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Nguyên liệu ({dish.ingredients.length})
        </h4>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {dish.ingredients.map((ingredient, index) => (
            <li key={`${ingredient}-${index}`} className="rounded-full bg-muted px-3 py-1 text-sm">
              {ingredient}
            </li>
          ))}
        </ul>
      </section>

      {dish.steps.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Cách nấu ({dish.steps.length} bước)
          </h4>
          <ol className="mt-3 space-y-3">
            {dish.steps.map((step, index) => (
              <li key={index} className="flex gap-3">
                <span
                  aria-hidden
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary tabular-nums"
                >
                  {index + 1}
                </span>
                <span className="pt-0.5 text-[0.95rem] leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
