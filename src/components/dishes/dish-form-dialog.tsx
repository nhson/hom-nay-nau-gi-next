"use client";

import { useState } from "react";
import {
  dishToFormInput,
  normalizeDishForm,
  type Category,
  type Dish,
  type DishFormErrors,
  type DishFormInput,
  type MealType,
  type Region,
} from "@/domain";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_LABEL, REGION_LABEL } from "@/lib/labels";

const EMPTY_FORM: DishFormInput = {
  name: "",
  mealType: "buacom",
  category: "",
  time: "",
  region: "",
  chay: false,
  ingredients: "",
  steps: "",
};

interface DishFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The dish being edited, or null to add a new one. */
  dish: Dish | null;
  /** The dish is a catalog dish the user has already edited. */
  edited: boolean;
  onSave: (id: string | null, dish: Omit<Dish, "id">) => void;
  onReset: (id: string) => void;
}

export function DishFormDialog({ open, onOpenChange, dish, edited, onSave, onReset }: DishFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Mounted only while open, so the form starts fresh from `dish` every time. */}
        <DishForm
          dish={dish}
          edited={edited}
          onCancel={() => onOpenChange(false)}
          onSave={(id, value) => {
            onSave(id, value);
            onOpenChange(false);
          }}
          onReset={(id) => {
            onReset(id);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function DishForm({
  dish,
  edited,
  onCancel,
  onSave,
  onReset,
}: {
  dish: Dish | null;
  edited: boolean;
  onCancel: () => void;
  onSave: DishFormDialogProps["onSave"];
  onReset: DishFormDialogProps["onReset"];
}) {
  const [form, setForm] = useState<DishFormInput>(dish ? dishToFormInput(dish) : EMPTY_FORM);
  const [errors, setErrors] = useState<DishFormErrors>({});
  const set = <K extends keyof DishFormInput>(key: K, value: DishFormInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const result = normalizeDishForm(form);
    if (!result.ok) return setErrors(result.errors);
    onSave(dish?.id ?? null, result.dish);
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{dish ? "Sửa món" : "Thêm món mới"}</DialogTitle>
        <DialogDescription className="sr-only">Điền thông tin món ăn rồi bấm Lưu món.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-1.5">
        <Label htmlFor="dish-name">Tên món</Label>
        <Input
          id="dish-name"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="VD: Canh chua cá lóc"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "dish-name-error" : undefined}
        />
        {errors.name && (
          <p id="dish-name-error" className="text-sm text-destructive">
            Nhập tên món
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="dish-meal-type">Kiểu bữa ăn</Label>
        <NativeSelect
          id="dish-meal-type"
          value={form.mealType}
          onChange={(e) => set("mealType", e.target.value as MealType)}
        >
          <option value="buacom">Bữa cơm 3 món</option>
          <option value="buatomonuoc">Bữa 1 món</option>
        </NativeSelect>
      </div>

      {form.mealType === "buacom" && (
        <div className="grid gap-1.5">
          <Label htmlFor="dish-category">Nhóm món</Label>
          <NativeSelect
            id="dish-category"
            value={form.category}
            onChange={(e) => set("category", e.target.value as Category | "")}
            aria-invalid={errors.category ? true : undefined}
            aria-describedby={errors.category ? "dish-category-error" : undefined}
          >
            <option value="">Chọn nhóm món</option>
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABEL[category]}
              </option>
            ))}
          </NativeSelect>
          {errors.category && (
            <p id="dish-category-error" className="text-sm text-destructive">
              Chọn nhóm món
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="dish-time">Thời gian (phút)</Label>
          <Input
            id="dish-time"
            type="number"
            inputMode="numeric"
            min={1}
            value={form.time}
            onChange={(e) => set("time", e.target.value)}
            placeholder="20"
            aria-invalid={errors.time ? true : undefined}
            aria-describedby={errors.time ? "dish-time-error" : undefined}
          />
          {errors.time && (
            <p id="dish-time-error" className="text-sm text-destructive">
              Nhập số phút hợp lệ
            </p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="dish-region">Vùng miền</Label>
          <NativeSelect id="dish-region" value={form.region} onChange={(e) => set("region", e.target.value as Region | "")}>
            <option value="">Không chọn</option>
            {(Object.keys(REGION_LABEL) as Region[]).map((region) => (
              <option key={region} value={region}>
                {REGION_LABEL[region]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <Checkbox aria-label="Món chay" checked={form.chay} onCheckedChange={(value) => set("chay", value === true)} />
        <span>Món chay (không tỏi)</span>
      </label>

      <div className="grid gap-1.5">
        <Label htmlFor="dish-ingredients">Nguyên liệu (cách nhau bằng dấu phẩy)</Label>
        <Textarea
          id="dish-ingredients"
          value={form.ingredients}
          onChange={(e) => set("ingredients", e.target.value)}
          placeholder="cá lóc, cà chua, me, đậu bắp"
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="dish-steps">Hướng dẫn nấu (mỗi bước 1 dòng)</Label>
        <Textarea
          id="dish-steps"
          rows={5}
          value={form.steps}
          onChange={(e) => set("steps", e.target.value)}
          placeholder={"Cá làm sạch, cắt khúc\nĐun sôi nước, dầm me lấy nước chua"}
        />
      </div>

      {dish && edited && (
        <Button type="button" variant="outline" onClick={() => onReset(dish.id)}>
          Khôi phục bản gốc
        </Button>
      )}

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Huỷ
        </Button>
        <Button type="submit" className="flex-1">
          Lưu món
        </Button>
      </div>
    </form>
  );
}
