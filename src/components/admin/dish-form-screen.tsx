"use client";

import { ArrowLeft, Check, Loader2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { validateDish, type Category, type DishDraft, type DishProblem, type MealType, type Region } from "@/domain";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { groupOf, groupStyle } from "@/lib/category-style";
import { problemFieldId, problemMessage } from "@/lib/dish-problems";
import { BOWL_LABEL, CATEGORY_LABEL, REGION_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { AdminDish } from "@/shared/schemas";
import { Recipe } from "../recipe";
import { useAdmin } from "./admin-frame";
import { LinesEditor } from "./lines-editor";

interface FormState {
  name: string;
  mealType: MealType;
  category: Category;
  region: Region | "";
  time: string;
  chay: boolean;
  ingredients: string[];
  steps: string[];
}

const EMPTY: FormState = {
  name: "",
  mealType: "buacom",
  category: "xao",
  region: "",
  time: "",
  chay: false,
  ingredients: [""],
  steps: [""],
};

const fromDish = (dish: AdminDish): FormState => ({
  name: dish.name,
  mealType: dish.mealType,
  category: dish.category ?? "xao",
  region: dish.region ?? "",
  time: dish.time === null ? "" : String(dish.time),
  chay: dish.chay,
  ingredients: dish.ingredients.length > 0 ? dish.ingredients : [""],
  steps: dish.steps.length > 0 ? dish.steps : [""],
});

function toDraft(form: FormState): DishDraft {
  const time = form.time.trim();
  return {
    mealType: form.mealType,
    category: form.mealType === "buacom" ? form.category : null,
    chay: form.chay,
    region: form.region === "" ? null : form.region,
    name: form.name,
    time: time === "" ? null : Number(time),
    ingredients: form.ingredients,
    steps: form.steps,
  };
}

/** "Required" problems wait for a submit attempt; the rest (tỏi, duplicate name...) show as you type. */
const isSoft = (problem: DishProblem) => problem.code === "name-required" || problem.code === "ingredients-required";

const sameProblem = (a: DishProblem, b: DishProblem) => a.code === b.code && a.field === b.field && a.index === b.index;

const draftKey = (id: string | null) => `admin-draft:${id ?? "new"}`;

const SELECT =
  "h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30";

/** Add (id = null) or edit one dish. */
export function DishFormScreen({ id }: { id: string | null }) {
  const router = useRouter();
  const { setVersion, requireLogin } = useAdmin();

  const [all, setAll] = useState<AdminDish[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [initial, setInitial] = useState<string>(JSON.stringify(EMPTY));
  const [submitted, setSubmitted] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [serverProblems, setServerProblems] = useState<DishProblem[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const failRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => headingRef.current?.focus(), []);

  // Load the catalog (needed to check duplicate names) and, when editing, the dish itself.
  useEffect(() => {
    let cancelled = false;
    adminApi
      .listDishes()
      .then((catalog) => {
        if (cancelled) return;
        setVersion(catalog.version);
        setAll(catalog.dishes);
        const dish = id === null ? null : catalog.dishes.find((item) => item.id === id);
        if (id !== null && !dish) return setLoadFailed(true);
        const base = dish ? fromDish(dish) : EMPTY;
        setInitial(JSON.stringify(base));
        // Coming back from a session that expired mid-edit: restore what was typed.
        let restored: FormState | null = null;
        try {
          const saved = sessionStorage.getItem(draftKey(id));
          if (saved) restored = JSON.parse(saved) as FormState;
          sessionStorage.removeItem(draftKey(id));
        } catch {
          // Storage is only a convenience.
        }
        setForm(restored ?? base);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof AdminApiError && error.status === 401) requireLogin();
        else setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id, setVersion, requireLogin]);

  const dirty = JSON.stringify(form) !== initial;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const draft = useMemo(() => toDraft(form), [form]);
  const problems = useMemo<DishProblem[]>(() => {
    const own = validateDish(draft, all ?? [], id ?? undefined);
    return [...own, ...serverProblems.filter((extra) => !own.some((p) => sameProblem(p, extra)))];
  }, [draft, all, id, serverProblems]);

  const shown = problems.filter((problem) => submitted || !isSoft(problem));
  const errorsFor = (field: DishProblem["field"]) => {
    const map = new Map<number, string>();
    for (const problem of shown) if (problem.field === field) map.set(problem.index ?? 0, problemMessage(problem));
    return map;
  };
  const nameError = errorsFor("name").get(0);
  const timeError = errorsFor("time").get(0);
  const categoryError = errorsFor("category").get(0);

  function update(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }));
    setServerProblems([]);
    setSaveFailed(false);
  }

  function focusField(fieldId: string) {
    const element = document.getElementById(fieldId);
    element?.scrollIntoView({ block: "center" });
    element?.focus();
  }

  async function save(event?: FormEvent) {
    event?.preventDefault();
    setSubmitted(true);
    if (problems.length > 0) {
      setSummaryOpen(true);
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setSummaryOpen(false);
    setSaving(true);
    setSaveFailed(false);
    try {
      const saved = id === null ? await adminApi.createDish(draft) : await adminApi.updateDish(id, draft);
      setVersion(saved.version);
      toast.success(`Đã lưu và đăng. Danh mục lên v${saved.version}.`);
      setInitial(JSON.stringify(form));
      router.push("/admin");
    } catch (error) {
      setSaving(false);
      if (error instanceof AdminApiError && error.status === 401) {
        try {
          sessionStorage.setItem(draftKey(id), JSON.stringify(form));
        } catch {
          // Without storage the form simply starts over after signing in.
        }
        requireLogin();
      } else if (error instanceof AdminApiError && error.code === "validation_failed") {
        setServerProblems(error.issues);
        setSummaryOpen(true);
        requestAnimationFrame(() => summaryRef.current?.focus());
      } else {
        setSaveFailed(true);
        requestAnimationFrame(() => failRef.current?.focus());
      }
    }
  }

  function leave() {
    if (dirty) setLeaving(true);
    else router.push("/admin");
  }

  if (loadFailed) {
    return (
      <div role="alert" className="py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">Không mở được món này</h1>
        <p className="mt-2 text-muted-foreground">Món không tồn tại, hoặc không tải được dữ liệu.</p>
        <Link href="/admin" className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>
          Về danh sách
        </Link>
      </div>
    );
  }
  if (all === null) return <div aria-busy="true" aria-label="Đang tải" className="h-96 animate-pulse rounded-2xl bg-muted" />;

  const editing = id !== null;
  const bowl = form.mealType === "buatomonuoc";
  const updatedAt = all.find((dish) => dish.id === id)?.updatedAt;
  const updatedLabel = updatedAt ? ` · cập nhật ${new Date(updatedAt).toLocaleDateString("vi-VN")}` : "";

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button variant="ghost" className="h-11" onClick={leave}>
          <ArrowLeft aria-hidden /> Danh sách
        </Button>
        <div>
          <h1 ref={headingRef} tabIndex={-1} className="font-display text-3xl font-semibold outline-none">
            {editing ? "Sửa món" : "Thêm món"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {editing ? `Mã món ${id}${updatedLabel}` : "Mã món sẽ tự đặt khi lưu."}
          </p>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <form onSubmit={save} noValidate className="rounded-2xl border bg-card">
          {summaryOpen && problems.length > 0 && (
            <div ref={summaryRef} role="alert" tabIndex={-1} className="m-5 mb-0 flex gap-2.5 rounded-xl border border-destructive/35 bg-destructive/10 p-3.5 text-sm text-destructive outline-none focus-visible:ring-3 focus-visible:ring-destructive/40">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              <div>
                <b>Chưa lưu được. Cần sửa:</b>
                <ul className="mt-1.5 list-disc space-y-1 pl-5">
                  {problems.map((problem, i) => (
                    <li key={i}>
                      <a
                        href={`#${problemFieldId(problem)}`}
                        className="font-semibold underline underline-offset-3"
                        onClick={(event) => {
                          event.preventDefault();
                          focusField(problemFieldId(problem));
                        }}
                      >
                        {problemMessage(problem)}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {saveFailed && (
            <div ref={failRef} role="alert" tabIndex={-1} className="m-5 mb-0 flex gap-2.5 rounded-xl border border-destructive/35 bg-destructive/10 p-3.5 text-sm text-destructive outline-none">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              <div>
                <b>Không lưu được.</b> Mạng đang gián đoạn. Những gì bạn nhập vẫn còn ở đây.
                <div className="mt-2">
                  <Button type="button" variant="outline" size="sm" className="h-9 max-md:h-11" onClick={() => save()}>
                    Thử lại
                  </Button>
                </div>
              </div>
            </div>
          )}

          <section className="space-y-4 border-b p-5">
            <h2 className="font-display text-lg font-semibold">Thông tin chính</h2>
            <div>
              <Label htmlFor="f-name">Tên món</Label>
              <Input
                id="f-name"
                value={form.name}
                placeholder="Ví dụ: Canh chua cá lóc"
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? "f-name-e" : undefined}
                onChange={(event) => update({ name: event.target.value })}
                className="mt-1.5 h-12"
              />
              {nameError && (
                <p id="f-name-e" className="mt-1.5 text-[0.8125rem] text-destructive">
                  {nameError}
                </p>
              )}
            </div>
            <div>
              <Label id="l-meal">Kiểu bữa ăn</Label>
              <div role="group" aria-labelledby="l-meal" className="mt-1.5 flex gap-1 rounded-2xl bg-muted p-1">
                {(["buacom", "buatomonuoc"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={form.mealType === type}
                    onClick={() => update({ mealType: type })}
                    className={cn(
                      "h-11 flex-1 rounded-xl text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      form.mealType === type ? "bg-primary text-primary-foreground" : "hover:bg-background/60",
                    )}
                  >
                    {type === "buacom" ? "Bữa cơm 3 món" : BOWL_LABEL}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="f-cat">Nhóm món</Label>
                <select
                  id="f-cat"
                  className={cn(SELECT, "mt-1.5")}
                  disabled={bowl}
                  value={bowl ? "" : form.category}
                  aria-describedby="f-cat-hint"
                  onChange={(event) => update({ category: event.target.value as Category })}
                >
                  {bowl && <option value="">Không có</option>}
                  {(Object.keys(CATEGORY_LABEL) as Category[]).map((key) => (
                    <option key={key} value={key}>
                      {CATEGORY_LABEL[key]}
                    </option>
                  ))}
                </select>
                <p id="f-cat-hint" className="mt-1.5 text-[0.8125rem] text-muted-foreground">
                  {bowl ? "Bữa 1 món không có Nhóm món." : "Mỗi bữa cơm 3 món lấy đúng 1 món từ mỗi Nhóm món."}
                </p>
                {categoryError && <p className="mt-1 text-[0.8125rem] text-destructive">{categoryError}</p>}
              </div>
              <div>
                <Label htmlFor="f-region">Vùng miền</Label>
                <select id="f-region" className={cn(SELECT, "mt-1.5")} value={form.region} onChange={(event) => update({ region: event.target.value as Region | "" })}>
                  <option value="">Không ghi</option>
                  {(Object.keys(REGION_LABEL) as Region[]).map((key) => (
                    <option key={key} value={key}>
                      {REGION_LABEL[key]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="f-time">Thời gian nấu (phút)</Label>
                <Input
                  id="f-time"
                  inputMode="numeric"
                  value={form.time}
                  aria-invalid={timeError ? true : undefined}
                  aria-describedby={timeError ? "f-time-e" : undefined}
                  onChange={(event) => update({ time: event.target.value })}
                  className="mt-1.5 h-12"
                />
                {timeError && (
                  <p id="f-time-e" className="mt-1.5 text-[0.8125rem] text-destructive">
                    {timeError}
                  </p>
                )}
              </div>
              <div>
                <span id="l-chay" className="text-sm leading-none font-medium">
                  Món chay
                </span>
                <label className="mt-1.5 flex min-h-11 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    role="switch"
                    id="f-chay"
                    aria-labelledby="l-chay"
                    checked={form.chay}
                    onChange={(event) => update({ chay: event.target.checked })}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden
                    className="relative h-7 w-[46px] shrink-0 rounded-full bg-border transition-colors after:absolute after:top-[3px] after:left-[3px] after:size-[22px] after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-[18px] peer-focus-visible:ring-3 peer-focus-visible:ring-ring/60"
                  />
                  <span className="text-sm font-semibold">{form.chay ? "Món chay (không dùng tỏi)" : "Không phải món chay"}</span>
                </label>
              </div>
            </div>
          </section>

          <section className="border-b p-5">
            <h2 className="mb-3.5 font-display text-lg font-semibold">Nguyên liệu</h2>
            <LinesEditor kind="ing" lines={form.ingredients} onChange={(ingredients) => update({ ingredients })} errors={errorsFor("ingredients")} />
          </section>

          <section className="p-5">
            <h2 className="mb-3.5 font-display text-lg font-semibold">Các bước nấu</h2>
            <LinesEditor kind="step" lines={form.steps} onChange={(steps) => update({ steps })} errors={errorsFor("steps")} />
          </section>

          <div className="sticky bottom-0 flex flex-wrap items-center gap-2.5 rounded-b-2xl border-t bg-card/95 px-5 py-3.5 backdrop-blur">
            <p className="min-w-52 flex-[1_1_100%] text-[0.8125rem] text-muted-foreground sm:flex-1">Lưu là đăng ngay: không có bản nháp.</p>
            <Button type="button" variant="outline" size="lg" className="max-sm:flex-1" disabled={saving} onClick={leave}>
              Huỷ
            </Button>
            <Button type="submit" size="lg" className="max-sm:flex-1" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 aria-hidden className="animate-spin" /> Đang lưu…
                </>
              ) : (
                <>
                  <Check aria-hidden /> Lưu và đăng
                </>
              )}
            </Button>
          </div>
        </form>

        <Preview form={form} className="max-lg:hidden" />
      </div>

      <Dialog open={leaving} onOpenChange={setLeaving}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Bỏ thay đổi chưa lưu?</DialogTitle>
            <DialogDescription>Bạn đã sửa món này nhưng chưa bấm Lưu và đăng.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaving(false)}>
              Ở lại sửa
            </Button>
            <Button
              className="bg-destructive text-white hover:bg-destructive/90 dark:text-background"
              onClick={() => {
                setInitial(JSON.stringify(form));
                setLeaving(false);
                router.push("/admin");
              }}
            >
              Bỏ thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** The dish as people will see it in the app (the same recipe component). */
function Preview({ form, className }: { form: FormState; className?: string }) {
  const lines = (values: string[]) => values.map((value) => value.trim()).filter(Boolean);
  const style = groupStyle(groupOf({ category: form.mealType === "buacom" ? form.category : null }));
  return (
    <aside aria-label="Xem trước" className={cn("sticky top-20 rounded-2xl border bg-card p-5", className)}>
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Người dùng sẽ thấy</p>
      <h2 className="mt-2 font-display text-2xl leading-tight font-semibold">{form.name.trim() || "Tên món"}</h2>
      <p className="mt-2 mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
          <span aria-hidden className={cn("size-2 rounded-full bg-current", style.iconClass)} />
          {style.label}
        </span>
        {form.chay && <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">Chay</span>}
        {form.time.trim() !== "" && <span>{form.time.trim()} phút</span>}
      </p>
      <Recipe dish={{ ingredients: lines(form.ingredients), steps: lines(form.steps) }} />
    </aside>
  );
}
