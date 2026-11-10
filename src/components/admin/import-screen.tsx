"use client";

import { Download, FileUp, Loader2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DISH_FILE_MAX_BYTES,
  DISH_FILE_MAX_DISHES,
  dishFileTemplate,
  readDishFile,
  type DishFileField,
  type DishFileRefusal,
  type DishFileSkip,
  type DishFileWarning,
} from "@/domain";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { useAdmin } from "./admin-frame";

const FIELD_LABEL: Record<DishFileField, string> = {
  mealType: "Kiểu bữa ăn",
  category: "Nhóm món",
  chay: "Chay",
  region: "Vùng miền",
  time: "Thời gian",
  ingredients: "Nguyên liệu",
  steps: "Các bước",
};

function warningText(warning: DishFileWarning): string {
  if (warning.code === "missing") return `Thiếu ${FIELD_LABEL[warning.field]}.`;
  if (warning.code === "unrecognised") return `Không hiểu ${FIELD_LABEL[warning.field]}, để trống.`;
  if (warning.code === "name-cut") return "Tên dài quá 60 ký tự, đã cắt bớt.";
  if (warning.code === "chay-toi") return "Món chay có nhắc “tỏi”: sửa trước khi Duyệt.";
  return `Có thể trùng với “${warning.name}”.`;
}

const SKIP_TEXT: Record<DishFileSkip["reason"], string> = {
  no_name: "Không có tên món",
  duplicate: "Bỏ qua vì trùng tên",
  repeated_in_file: "Trùng tên với một món ở trên trong file",
};

const MB = DISH_FILE_MAX_BYTES / 1_000_000;

const REFUSAL_TEXT: Record<DishFileRefusal | "too_large", string> = {
  not_json: "File này không phải JSON hợp lệ. Mở file kiểm tra dấu ngoặc và dấu phẩy, hoặc bắt đầu từ file mẫu.",
  no_dishes: "Không tìm thấy danh sách món trong file. File cần là một danh sách món, hoặc có dạng { \"dishes\": [ ... ] } như file Xuất JSON.",
  too_many: `File có hơn ${DISH_FILE_MAX_DISHES} món. Chia thành nhiều file nhỏ hơn rồi nhập từng file.`,
  too_large: `File lớn hơn ${MB} MB. Chia thành nhiều file nhỏ hơn rồi nhập từng file.`,
};

const FIELD_GUIDE: { field: string; meaning: string; values: string }[] = [
  { field: "name", meaning: "Tên món (bắt buộc)", values: "Tối đa 60 ký tự. Món trùng tên với Danh mục món hoặc Chờ duyệt bị bỏ qua." },
  { field: "mealType", meaning: "Kiểu bữa ăn", values: "buacom hoặc “Bữa cơm 3 món”; buatomonuoc hoặc “Bữa 1 món”. Thiếu thì coi là Bữa cơm 3 món." },
  { field: "category", meaning: "Nhóm món", values: "xao / canh / man, hoặc “Xào”, “Canh”, “Mặn”. Bữa 1 món không cần." },
  { field: "chay", meaning: "Món chay", values: "true / false, hoặc “có” / “không”. Thiếu thì là không chay." },
  { field: "region", meaning: "Vùng miền", values: "bac / trung / nam, hoặc “Miền Bắc”, “Miền Trung”, “Miền Nam”. Có thể bỏ trống." },
  { field: "time", meaning: "Thời gian nấu", values: "Số phút, ví dụ 30, hoặc chữ như “1 giờ 30 phút”. Có thể bỏ trống." },
  { field: "ingredients", meaning: "Nguyên liệu", values: "Một danh sách, hoặc một đoạn chữ mỗi dòng một nguyên liệu." },
  { field: "steps", meaning: "Các bước", values: "Như nguyên liệu: danh sách, hoặc mỗi dòng một bước." },
];

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([dishFileTemplate()], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "mau-nhap-mon.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Nhập từ file (spec #41): a JSON file of dishes, previewed here with the same reader the server uses,
 * then added to Chờ duyệt in one go. No AI. Nothing reaches the public Danh mục món before Duyệt.
 */
export function ImportScreen() {
  const router = useRouter();
  const { requireLogin, refreshPendingCount } = useAdmin();
  const heading = useRef<HTMLHeadingElement>(null);
  const problemRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [knownNames, setKnownNames] = useState<string[]>([]);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => heading.current?.focus(), []);

  // The names a file may not repeat: the Danh mục món (hidden dishes included) and Chờ duyệt. The
  // server checks again when saving, so a failure here only makes the preview less exact.
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([adminApi.listDishes(), adminApi.listPending()]).then(([dishes, pending]) => {
      if (cancelled) return;
      const failure = [dishes, pending].find((result) => result.status === "rejected");
      if (failure && failure.reason instanceof AdminApiError && failure.reason.status === 401) return requireLogin();
      setKnownNames([
        ...(dishes.status === "fulfilled" ? dishes.value.dishes.map((dish) => dish.name) : []),
        ...(pending.status === "fulfilled" ? pending.value.items.map((item) => item.name) : []),
      ]);
    });
    return () => {
      cancelled = true;
    };
  }, [requireLogin]);

  const reading = useMemo(() => (file ? readDishFile(file.text, knownNames) : null), [file, knownNames]);
  const refusal = reading && !reading.ok ? REFUSAL_TEXT[reading.refusal] : null;
  const shown = problem ?? refusal;

  useEffect(() => {
    if (shown) problemRef.current?.focus();
  }, [shown]);
  useEffect(() => {
    if (reading?.ok) previewRef.current?.focus();
  }, [reading?.ok, file]);

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    setProblem(null);
    setFile(null);
    if (!chosen) return;
    if (chosen.size > DISH_FILE_MAX_BYTES) return setProblem(REFUSAL_TEXT.too_large);
    try {
      setFile({ name: chosen.name, text: await chosen.text() });
    } catch {
      setProblem("Không đọc được file này. Thử chọn lại.");
    }
  }

  async function save() {
    if (!file || !reading?.ok) return;
    setSaving(true);
    try {
      const result = await adminApi.importFile(file.name, file.text);
      refreshPendingCount();
      toast.success(
        result.added.length > 0
          ? `Đã thêm ${result.added.length} món vào Chờ duyệt${result.skipped.length > 0 ? `, bỏ qua ${result.skipped.length}` : ""}.`
          : "Không thêm món nào: mọi món đều bị bỏ qua.",
      );
      router.push("/admin/review");
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) requireLogin();
      else if (error instanceof AdminApiError && error.status === 413) setProblem(REFUSAL_TEXT.too_large);
      else if (error instanceof AdminApiError && error.refusal && error.refusal in REFUSAL_TEXT) {
        setProblem(REFUSAL_TEXT[error.refusal as DishFileRefusal]);
      } else setProblem("Không thêm được. Kiểm tra mạng rồi thử lại.");
    } finally {
      setSaving(false);
    }
  }

  const warned = reading?.ok ? reading.add.filter((item) => item.warnings.length > 0).length : 0;

  return (
    <div>
      <div className="mb-5">
        <h1 ref={heading} tabIndex={-1} className="font-display text-3xl font-semibold outline-none">
          Nhập từ file
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Thêm nhiều món một lúc từ một file JSON. Các món vào Chờ duyệt để bạn kiểm tra; người dùng chưa thấy món nào cho tới khi bạn Duyệt.
          File không bao giờ sửa hay ẩn món đã có.
        </p>
      </div>

      <section aria-labelledby="pick-title" className="mb-6 rounded-2xl border bg-card p-5">
        <h2 id="pick-title" className="font-display text-lg font-semibold">
          Chọn file
        </h2>
        <p id="pick-hint" className="mt-1 text-sm text-muted-foreground">
          Một file .json, tối đa {DISH_FILE_MAX_DISHES} món và {MB} MB. File từ Xuất JSON dùng được ngay.
        </p>
        <div className="mt-3 flex flex-wrap gap-2.5">
          <input
            ref={input}
            id="dish-file"
            type="file"
            accept=".json,application/json"
            className="sr-only"
            tabIndex={-1}
            aria-label="Chọn file JSON"
            aria-describedby="pick-hint"
            onChange={choose}
          />
          <Button size="lg" onClick={() => input.current?.click()} disabled={saving}>
            <FileUp aria-hidden /> {file ? "Chọn file khác" : "Chọn file JSON"}
          </Button>
          <Button size="lg" variant="outline" onClick={downloadTemplate}>
            <Download aria-hidden /> Tải file mẫu
          </Button>
        </div>

        {shown && (
          <div
            ref={problemRef}
            role="alert"
            tabIndex={-1}
            className="mt-4 rounded-xl border border-destructive/35 bg-destructive/10 p-3.5 text-sm text-destructive outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {file && <b className="block">{file.name}</b>}
            {shown}
          </div>
        )}
      </section>

      {file && reading?.ok && (
        <section aria-labelledby="preview-title" className="mb-6 rounded-2xl border bg-card p-5">
          <h2 ref={previewRef} id="preview-title" tabIndex={-1} className="font-display text-lg font-semibold outline-none">
            Xem trước: {file.name}
          </h2>
          <dl className="mt-3 flex flex-wrap gap-2.5">
            <Count label="Sẽ thêm" value={reading.add.length} />
            <Count label="Bỏ qua" value={reading.skipped.length} />
            <Count label="Có cảnh báo" value={warned} />
          </dl>

          {reading.add.length > 0 && (
            <>
              <h3 className="mt-5 text-sm font-semibold">Sẽ thêm vào Chờ duyệt</h3>
              <ul className="mt-2 divide-y rounded-xl border">
                {reading.add.map((item) => (
                  <li key={item.row} className="px-3.5 py-2.5 text-sm">
                    <span className="text-muted-foreground">#{item.row}</span> <b>{item.draft.name}</b>
                    {item.warnings.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-amber-800 dark:text-amber-300">
                        {item.warnings.map((warning, index) => (
                          <li key={index} className="flex gap-1.5">
                            <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                            {warningText(warning)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {reading.skipped.length > 0 && (
            <>
              <h3 className="mt-5 text-sm font-semibold">Bỏ qua</h3>
              <ul className="mt-2 divide-y rounded-xl border">
                {reading.skipped.map((item) => (
                  <li key={item.row} className="px-3.5 py-2.5 text-sm">
                    <span className="text-muted-foreground">#{item.row}</span> {item.name && <b>{item.name}</b>}
                    <span className="text-muted-foreground">
                      {item.name ? " · " : ""}
                      {SKIP_TEXT[item.reason]}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-5 flex flex-wrap gap-2.5">
            <Button size="lg" onClick={save} disabled={saving || reading.add.length === 0}>
              {saving && <Loader2 aria-hidden className="animate-spin" />}
              Thêm {reading.add.length} món vào Chờ duyệt
            </Button>
          </div>
        </section>
      )}

      <section aria-labelledby="guide-title" className="rounded-2xl border bg-card p-5">
        <h2 id="guide-title" className="font-display text-lg font-semibold">
          Cách viết file
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Một danh sách món, hoặc <code>{"{ \"dishes\": [ ... ] }"}</code> như file Xuất JSON. Chỉ <code>name</code> là bắt buộc; giá trị thiếu
          hoặc không hiểu được để trống và có cảnh báo, bạn sửa khi duyệt. Chữ hoa, chữ thường và dấu không quan trọng. Các trường khác (như{" "}
          <code>id</code>, <code>version</code>, <code>retired</code>) bị bỏ qua.
        </p>
        <dl className="mt-3 divide-y rounded-xl border">
          {FIELD_GUIDE.map((row) => (
            <div key={row.field} className="grid gap-x-4 gap-y-0.5 px-3.5 py-2.5 text-sm sm:grid-cols-[12rem_1fr]">
              <dt>
                <code className="font-semibold">{row.field}</code> <span className="text-muted-foreground">· {row.meaning}</span>
              </dt>
              <dd className="text-muted-foreground">{row.values}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-w-24 flex-col-reverse rounded-2xl border bg-background px-3.5 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-display text-xl font-semibold">{value}</dd>
    </div>
  );
}
