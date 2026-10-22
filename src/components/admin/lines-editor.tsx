"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  /** "ing" or "step": also the prefix of each line's control id (ing-0, step-2) that error links point to. */
  kind: "ing" | "step";
  lines: string[];
  onChange: (lines: string[]) => void;
  /** Error text per line index, shown under the line. */
  errors: Map<number, string>;
}

const ICON_BUTTON = "size-11 text-muted-foreground";

/** An editable list of ingredient (single line) or step (multi-line, reorderable) rows. */
export function LinesEditor({ kind, lines, onChange, errors }: Props) {
  const isStep = kind === "step";
  const noun = isStep ? "bước" : "nguyên liệu";

  const set = (index: number, value: string) => onChange(lines.map((line, i) => (i === index ? value : line)));
  const remove = (index: number) => onChange(lines.length > 1 ? lines.filter((_, i) => i !== index) : [""]);
  const move = (index: number, by: -1 | 1) => {
    const next = [...lines];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange(next);
  };

  return (
    <div>
      <ol className="space-y-2.5" aria-label={isStep ? "Các bước nấu" : "Nguyên liệu"}>
        {lines.map((line, index) => {
          const id = `${kind}-${index}`;
          const error = errors.get(index);
          return (
            <li key={index}>
              <div className="flex flex-wrap items-start gap-2">
                {isStep && (
                  <span aria-hidden className="mt-2.5 grid size-7 shrink-0 place-items-center rounded-full border bg-muted text-xs font-bold text-turmeric-text">
                    {index + 1}
                  </span>
                )}
                {isStep ? (
                  <Textarea
                    id={id}
                    rows={2}
                    value={line}
                    aria-label={`Bước ${index + 1}`}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-e` : undefined}
                    placeholder={`Mô tả bước ${index + 1}`}
                    onChange={(event) => set(index, event.target.value)}
                    className="min-w-0 flex-[1_1_calc(100%-3rem)] sm:flex-[1_1_0]"
                  />
                ) : (
                  <Input
                    id={id}
                    value={line}
                    aria-label={`Nguyên liệu ${index + 1}`}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-e` : undefined}
                    placeholder="Ví dụ: Cà chua 2 quả"
                    onChange={(event) => set(index, event.target.value)}
                    className="h-11 flex-1"
                  />
                )}
                <div className={isStep ? "flex gap-1.5 max-sm:ml-9" : "contents"}>
                  {isStep && (
                    <>
                      <Button type="button" variant="outline" size="icon" className={ICON_BUTTON} disabled={index === 0} aria-label={`Chuyển bước ${index + 1} lên`} onClick={() => move(index, -1)}>
                        <ArrowUp aria-hidden />
                      </Button>
                      <Button type="button" variant="outline" size="icon" className={ICON_BUTTON} disabled={index === lines.length - 1} aria-label={`Chuyển bước ${index + 1} xuống`} onClick={() => move(index, 1)}>
                        <ArrowDown aria-hidden />
                      </Button>
                    </>
                  )}
                  <Button type="button" variant="outline" size="icon" className={ICON_BUTTON} aria-label={`Xoá ${noun} ${index + 1}`} onClick={() => remove(index)}>
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </div>
              {error && (
                <p id={`${id}-e`} className={`mt-1.5 flex gap-1.5 text-[0.8125rem] text-destructive ${isStep ? "sm:ml-9" : ""}`}>
                  {error}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <Button type="button" variant="outline" className="mt-3 h-9 max-md:h-11" onClick={() => onChange([...lines, ""])}>
        <Plus aria-hidden /> {isStep ? "Thêm bước" : "Thêm nguyên liệu"}
      </Button>
    </div>
  );
}
