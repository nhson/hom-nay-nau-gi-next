"use client";

import { Lock, TriangleAlert } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { LOCK_MINUTES, SESSION_DAYS } from "@/shared/admin-policy";

/** Only ever send the person back somewhere inside the admin. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export function LoginScreen() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ kind: "wrong" | "locked" | "unavailable" | "network"; until?: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      await adminApi.login(passphrase);
      router.replace(next);
    } catch (error) {
      setBusy(false);
      if (error instanceof AdminApiError && error.code === "invalid_credentials") setProblem({ kind: "wrong" });
      else if (error instanceof AdminApiError && error.code === "locked") setProblem({ kind: "locked", until: error.lockedUntil });
      else if (error instanceof AdminApiError && error.code === "admin_unavailable") setProblem({ kind: "unavailable" });
      else setProblem({ kind: "network" });
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-7 shadow-sm">
        <div className="flex items-center gap-2.5 font-display text-lg font-semibold">
          <span aria-hidden className="grid size-[34px] place-items-center rounded-full bg-primary text-primary-foreground">
            <Lock className="size-[18px]" />
          </span>
          Quản trị
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold">Đăng nhập</h1>
        <p className="mt-1 mb-5 text-sm leading-relaxed text-muted-foreground">
          Chỉ dành cho quản trị viên. Nhập mật khẩu để cập nhật Danh mục món.
        </p>

        <form onSubmit={submit} noValidate>
          {problem && (
            <div role="alert" className="mb-4 flex gap-2.5 rounded-xl border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              <div>
                {problem.kind === "wrong" && "Mật khẩu không đúng."}
                {problem.kind === "locked" && (
                  <>
                    <b>Tạm khoá {LOCK_MINUTES} phút.</b> Đã nhập sai nhiều lần liên tiếp.
                    {problem.until && ` Thử lại sau ${clock(problem.until)}.`}
                  </>
                )}
                {problem.kind === "unavailable" && "Trang quản trị chưa được bật cho trang web này."}
                {problem.kind === "network" && "Không kết nối được máy chủ. Thử lại."}
              </div>
            </div>
          )}
          <Label htmlFor="pw">Mật khẩu</Label>
          <Input
            id="pw"
            type="password"
            autoComplete="current-password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            className="mt-1.5 h-12"
            required
          />
          <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">Đăng nhập được giữ {SESSION_DAYS} ngày trên thiết bị này.</p>
          <Button type="submit" size="lg" className="mt-5 w-full" disabled={busy || passphrase === ""}>
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
          </Button>
        </form>
      </div>
    </div>
  );
}
