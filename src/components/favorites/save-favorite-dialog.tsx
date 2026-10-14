"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { defaultFavoriteName } from "@/domain";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "../app-provider";

export function SaveFavoriteButton() {
  const { state, today, dispatch } = useApp();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" aria-label="Lưu thực đơn yêu thích">
          <Star aria-hidden /> Lưu
        </Button>
      </DialogTrigger>
      <DialogContent>
        {/* Mounted only while open so the default name is computed fresh each time. */}
        <SaveForm
          defaultName={defaultFavoriteName(state.todayMenu?.date ?? today)}
          onCancel={() => setOpen(false)}
          onSave={(name) => {
            dispatch({ type: "save-favorite", name });
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function SaveForm({
  defaultName,
  onCancel,
  onSave,
}: {
  defaultName: string;
  onCancel: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(defaultName);
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(name);
      }}
    >
      <DialogHeader>
        <DialogTitle>Lưu thực đơn yêu thích</DialogTitle>
        <DialogDescription className="sr-only">Đặt tên cho thực đơn để dùng lại sau.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="favorite-name">Tên thực đơn</Label>
        <Input id="favorite-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Mâm cơm cuối tuần" />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Huỷ
        </Button>
        <Button type="submit" className="flex-1">
          Lưu
        </Button>
      </div>
    </form>
  );
}
