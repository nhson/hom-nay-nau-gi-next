"use client";

import { ArrowLeft, Check, ExternalLink, Loader2, Save, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  cleanLines,
  mergeProblems,
  parseMinutes,
  validateDish,
  waitsForSubmit,
  type Category,
  type DishDraft,
  type DishProblem,
  type MealType,
  type Region,
} from "@/domain";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { groupOf, groupStyle } from "@/lib/category-style";
import { problemFieldId, problemMessage } from "@/lib/dish-problems";
import { BOWL_LABEL, CATEGORY_LABEL, REGION_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { AdminDish, PendingDish } from "@/shared/schemas";
import { Recipe } from "../recipe";
import { useAdmin } from "./admin-frame";
import { LinesEditor } from "./lines-editor";
import { sourceLabel, sourceSite, warningHref, warningText } from "./review-labels";

interface FormState {
  name: string;
  mealType: MealType;
  /** "" only for a Món chờ duyệt the model could not place in a Nhóm món. */
  category: Category | "";
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

type DraftFields = Pick<AdminDish, "name" | "mealType" | "category" | "region" | "time" | "chay" | "ingredients" | "steps">;

const fromDish = (dish: DraftFields): FormState => ({
  name: dish.name,
  mealType: dish.mealType,
  // A Bữa 1 món keeps a default for when it is switched to Bữa cơm 3 món; a proposal without a Nhóm món stays unset.
  category: dish.category ?? (dish.mealType === "buatomonuoc" ? "xao" : ""),
  region: dish.region ?? "",
  time: dish.time === null ? "" : String(dish.time),
  chay: dish.chay,
  ingredients: dish.ingredients.length > 0 ? dish.ingredients : [""],
  steps: dish.steps.length > 0 ? dish.steps : [""],
});

function toDraft(form: FormState): DishDraft {
  return {
    mealType: form.mealType,
    category: form.mealType === "buacom" && form.category !== "" ? form.category : null,
    chay: form.chay,
    region: form.region === "" ? null : form.region,
    name: form.name,
    time: parseMinutes(form.time),
    ingredients: form.ingredients,
    steps: form.steps,
  };
}

const draftKey = (id: string | null, pendingId?: string) =>
  pendingId ? `admin-draft:pending:${pendingId}` : `admin-draft:${id ?? "new"}`;

const SELECT =
  "h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30";

/**
 * Add (id = null) or edit one dish; or, with `pendingId`, review a Món chờ duyệt: Lưu keeps the edits,
 * Duyệt publishes it as a new dish, Bỏ discards it (ADR-0006).
 */
export function DishFormScreen({ id, pendingId }: { id: string | null; pendingId?: string }) {
  const router = useRouter();
  const { setVersion, requireLogin, pendingCount, setPendingCount } = useAdmin();
  const reviewing = pendingId !== undefined;
  const home = reviewing ? "/admin/review" : "/admin/dishes";

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
  const [pending, setPending] = useState<PendingDish | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [busy, setBusy] = useState<"save" | "discard" | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const failRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => headingRef.current?.focus(), []);

  // Load the catalog (needed to check duplicate names) and, when editing, the dish or the Món chờ duyệt itself.
  useEffect(() => {
    let cancelled = false;
    Promise.all([adminApi.listDishes(), pendingId === undefined ? Promise.resolve(null) : adminApi.getPending(pendingId)])
      .then(([catalog, proposal]) => {
        if (cancelled) return;
        setVersion(catalog.version);
        setAll(catalog.dishes);
        setPending(proposal);
        const dish = id === null ? null : catalog.dishes.find((item) => item.id === id);
        if (id !== null && !dish) return setLoadFailed(true);
        const base = proposal ? fromDish(proposal) : dish ? fromDish(dish) : EMPTY;
        setInitial(JSON.stringify(base));
        // Coming back from a session that expired mid-edit: restore what was typed.
        let restored: FormState | null = null;
        try {
          const saved = sessionStorage.getItem(draftKey(id, pendingId));
          if (saved) restored = JSON.parse(saved) as FormState;
          sessionStorage.removeItem(draftKey(id, pendingId));
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
  }, [id, pendingId, setVersion, requireLogin]);

  const dirty = JSON.stringify(form) !== initial;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const draft = useMemo(() => toDraft(form), [form]);
  const problems = useMemo<DishProblem[]>(
    () => mergeProblems(validateDish(draft, all ?? [], id ?? undefined), serverProblems),
    [draft, all, id, serverProblems],
  );

  const shown = problems.filter((problem) => submitted || !waitsForSubmit(problem));
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

  /** The session ended mid-edit: keep what was typed for after signing in. */
  function keepForLogin() {
    try {
      sessionStorage.setItem(draftKey(id, pendingId), JSON.stringify(form));
    } catch {
      // Without storage the form simply starts over after signing in.
    }
    requireLogin();
  }

  const countDown = () => setPendingCount(Math.max(0, (pendingCount ?? 1) - 1));

  /** Lưu (review mode): keep the edits on the Món chờ duyệt without publishing. Only an impossible time blocks it. */
  async function saveEdits() {
    if (!pendingId) return;
    if (problems.some((problem) => problem.code === "time-invalid")) {
      setSubmitted(true);
      setSummaryOpen(true);
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setBusy("save");
    setSaveFailed(false);
    try {
      setPending(await adminApi.updatePending(pendingId, draft));
      setInitial(JSON.stringify(form));
      toast.success("Đã lưu. Món vẫn ở Chờ duyệt.");
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) keepForLogin();
      else if (error instanceof AdminApiError && error.status === 404) setLoadFailed(true);
      else {
        setSaveFailed(true);
        requestAnimationFrame(() => failRef.current?.focus());
      }
    } finally {
      setBusy(null);
    }
  }

  /** Bỏ (review mode), after the confirmation dialog. */
  async function discard() {
    if (!pendingId) return;
    setDiscarding(false);
    setBusy("discard");
    try {
      await adminApi.discardPending(pendingId);
      countDown();
      toast.success(`Đã bỏ “${form.name.trim() || "món chờ duyệt"}”.`);
      setInitial(JSON.stringify(form));
      router.push(home);
    } catch (error) {
      setBusy(null);
      if (error instanceof AdminApiError && error.status === 401) keepForLogin();
      else if (error instanceof AdminApiError && error.status === 404) router.push(home);
      else toast.error("Chưa bỏ được. Thử lại.");
    }
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
      const saved = pendingId
        ? await adminApi.approvePending(pendingId, draft)
        : id === null
          ? await adminApi.createDish(draft)
          : await adminApi.updateDish(id, draft);
      setVersion(saved.version);
      if (pendingId) {
        countDown();
        toast.success(`Đã duyệt “${saved.dish.name}” (mã ${saved.dish.id}). Danh mục lên v${saved.version}.`);
      } else {
        toast.success(`Đã lưu và đăng. Danh mục lên v${saved.version}.`);
      }
      setInitial(JSON.stringify(form));
      router.push(home);
    } catch (error) {
      setSaving(false);
      if (error instanceof AdminApiError && error.status === 401) {
        keepForLogin();
      } else if (pendingId && error instanceof AdminApiError && error.status === 404) {
        setLoadFailed(true);
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
    else router.push(home);
  }

  if (loadFailed) {
    return (
      <div role="alert" className="py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">{reviewing ? "Không mở được món chờ duyệt này" : "Không mở được món này"}</h1>
        <p className="mt-2 text-muted-foreground">
          {reviewing ? "Món có thể đã được duyệt hoặc bỏ, hoặc không tải được dữ liệu." : "Món không tồn tại, hoặc không tải được dữ liệu."}
        </p>
        <Link href={home} className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>
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
          <ArrowLeft aria-hidden /> {reviewing ? "Chờ duyệt" : "Danh sách"}
        </Button>
        <div>
          <h1 ref={headingRef} tabIndex={-1} className="font-display text-3xl font-semibold outline-none">
            {reviewing ? "Duyệt món" : editing ? "Sửa món" : "Thêm món"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {pending
              ? `${sourceLabel(pending)} · ${new Date(pending.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}${pending.model ? ` · ${pending.model}` : ""}`
              : editing
                ? `Mã món ${id}${updatedLabel}`
                : "Mã món sẽ tự đặt khi lưu."}
          </p>
          {pending?.source.kind === "agent" && pending.source.url && (
            <a
              href={pending.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Xem trang gốc trên {sourceSite(pending.source.url) ?? new URL(pending.source.url).host}
              <ExternalLink aria-hidden className="size-3.5" />
              <span className="sr-only">(mở thẻ mới)</span>
            </a>
          )}
        </div>
      </div>

      {pending && pending.warnings.length > 0 && (
        <section aria-labelledby="warn-title" className="mb-5 rounded-2xl border border-destructive/35 bg-destructive/5 p-4 text-sm">
          <h2 id="warn-title" className="flex items-center gap-2 font-semibold">
            <TriangleAlert aria-hidden className="size-4 text-destructive" /> Cần xem trước khi Duyệt
          </h2>
          <ul className="mt-1.5 list-disc space-y-1 pl-6">
            {pending.warnings.map((warning, i) => {
              const href = warningHref(warning);
              return (
                <li key={i}>
                  {warningText(warning)}
                  {href && (
                    <>
                      {" "}
                      <Link href={href} target="_blank" className="font-semibold underline underline-offset-3">
                        Xem món đó
                      </Link>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <form onSubmit={save} noValidate className="rounded-2xl border bg-card">
          {summaryOpen && problems.length > 0 && (
            <AlertBox ref={summaryRef}>
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
            </AlertBox>
          )}
          {saveFailed && (
            <AlertBox ref={failRef}>
              <b>Không lưu được.</b> Mạng đang gián đoạn. Những gì bạn nhập vẫn còn ở đây.
              <div className="mt-2">
                <Button type="button" variant="outline" size="sm" className="h-9 max-md:h-11" onClick={() => save()}>
                  Thử lại
                </Button>
              </div>
            </AlertBox>
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
                  aria-invalid={categoryError ? true : undefined}
                  aria-describedby="f-cat-hint"
                  onChange={(event) => update({ category: event.target.value as Category })}
                >
                  {bowl && <option value="">Không có</option>}
                  {!bowl && form.category === "" && (
                    <option value="" disabled>
                      Chọn Nhóm món
                    </option>
                  )}
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

          {reviewing ? (
            <div className="sticky bottom-0 flex flex-wrap items-center gap-2.5 rounded-b-2xl border-t bg-card/95 px-5 py-3.5 backdrop-blur">
              <p className="min-w-52 flex-[1_1_100%] text-[0.8125rem] text-muted-foreground sm:flex-1">
                Duyệt là đăng ngay vào Danh mục món. Lưu chỉ giữ lại bản sửa ở Chờ duyệt.
              </p>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="text-destructive max-sm:flex-1"
                disabled={saving || busy !== null}
                onClick={() => setDiscarding(true)}
              >
                <Trash2 aria-hidden /> Bỏ
              </Button>
              <Button type="button" variant="outline" size="lg" className="max-sm:flex-1" disabled={saving || busy !== null} onClick={saveEdits}>
                {busy === "save" ? <Loader2 aria-hidden className="animate-spin" /> : <Save aria-hidden />} Lưu
              </Button>
              <Button type="submit" size="lg" className="max-sm:flex-[1_1_100%]" disabled={saving || busy !== null}>
                {saving ? (
                  <>
                    <Loader2 aria-hidden className="animate-spin" /> Đang duyệt…
                  </>
                ) : (
                  <>
                    <Check aria-hidden /> Duyệt và đăng
                  </>
                )}
              </Button>
            </div>
          ) : (
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
          )}
        </form>

        <Preview form={form} className="max-lg:hidden" />
      </div>

      <Dialog open={leaving} onOpenChange={setLeaving}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Bỏ thay đổi chưa lưu?</DialogTitle>
            <DialogDescription>
              {reviewing ? "Bạn đã sửa món này nhưng chưa bấm Lưu hoặc Duyệt." : "Bạn đã sửa món này nhưng chưa bấm Lưu và đăng."}
            </DialogDescription>
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
                router.push(home);
              }}
            >
              Bỏ thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={discarding} onOpenChange={setDiscarding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Bỏ “{form.name.trim() || "món chờ duyệt này"}”?</DialogTitle>
            <DialogDescription>Món chờ duyệt này sẽ bị xoá. Danh mục món không thay đổi.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscarding(false)}>
              Giữ lại
            </Button>
            <Button className="bg-destructive text-white hover:bg-destructive/90 dark:text-background" onClick={discard}>
              <Trash2 aria-hidden /> Bỏ món
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** A problem or failure message that takes focus when it appears, so it is announced and reachable. */
function AlertBox({ ref, children }: { ref: React.Ref<HTMLDivElement>; children: React.ReactNode }) {
  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="m-5 mb-0 flex gap-2.5 rounded-xl border border-destructive/35 bg-destructive/10 p-3.5 text-sm text-destructive outline-none focus-visible:ring-3 focus-visible:ring-destructive/40"
    >
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

/** The dish as people will see it in the app (the same recipe component). */
function Preview({ form, className }: { form: FormState; className?: string }) {
  // A proposal without a Nhóm món yet previews as the first group; the form already asks for one.
  const style = groupStyle(groupOf({ category: form.mealType === "buacom" ? form.category || "xao" : null }));
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
      <Recipe dish={{ ingredients: cleanLines(form.ingredients), steps: cleanLines(form.steps) }} />
    </aside>
  );
}
