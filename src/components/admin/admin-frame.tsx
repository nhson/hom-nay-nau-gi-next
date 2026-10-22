"use client";

import { Download, LogOut } from "lucide-react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { adminApi, AdminApiError, EXPORT_URL } from "@/lib/admin-api";
import { cn } from "@/lib/utils";

interface AdminContextValue {
  /** The catalog version as last seen by this page (shown in the top bar). */
  version: number | null;
  setVersion: (version: number) => void;
  /** The session is gone: go to sign-in and come back to this page afterwards. */
  requireLogin: () => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (!value) throw new Error("useAdmin must be used inside <AdminFrame>");
  return value;
}

type Status = "checking" | "ready" | "unavailable" | "offline";

/** The signed-in admin area: checks the session, then shows the top bar around its pages. */
export function AdminFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>("checking");
  const [version, setVersion] = useState<number | null>(null);

  const requireLogin = useCallback(() => {
    router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
  }, [router, pathname]);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .session()
      .then(() => !cancelled && setStatus("ready"))
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof AdminApiError && error.status === 401) return requireLogin();
        setStatus(error instanceof AdminApiError && error.status === 503 ? "unavailable" : "offline");
      });
    return () => {
      cancelled = true;
    };
  }, [requireLogin]);

  const value = useMemo(() => ({ version, setVersion, requireLogin }), [version, requireLogin]);

  if (status === "unavailable") {
    return <Notice title="Trang quản trị chưa được bật" text="Chưa cài mật khẩu quản trị cho trang web này." />;
  }
  if (status === "offline") {
    return (
      <Notice title="Không kết nối được" text="Kiểm tra mạng rồi thử lại.">
        <Button onClick={() => location.reload()}>Thử lại</Button>
      </Notice>
    );
  }
  if (status === "checking") {
    return <div aria-busy="true" aria-label="Đang kiểm tra đăng nhập" className="min-h-dvh" />;
  }

  async function signOut() {
    try {
      await adminApi.logout();
    } finally {
      router.replace("/admin/login");
    }
  }

  return (
    <AdminContext.Provider value={value}>
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-3.5 py-2.5 md:px-6">
          <Image src="/icons/icon.svg" alt="" width={34} height={34} unoptimized className="size-[34px] rounded-full" />
          <span className="hidden font-display text-lg font-semibold sm:inline">Hôm nay nấu gì?</span>
          <span className="rounded-full border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">Quản trị</span>
          <span className="flex-1" />
          {version !== null && (
            <span className="hidden rounded-full border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground md:inline">
              Danh mục v{version}
            </span>
          )}
          <a href={EXPORT_URL} download className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-11 md:h-9")}>
            <Download aria-hidden />
            <span className="max-md:sr-only">Xuất JSON</span>
          </a>
          <Button variant="ghost" size="sm" className="h-11 md:h-9" onClick={signOut}>
            <LogOut aria-hidden />
            <span className="max-md:sr-only">Đăng xuất</span>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-3.5 pt-6 pb-16 md:px-6 md:pt-8">{children}</main>
    </AdminContext.Provider>
  );
}

function Notice({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-sm text-center">
        <h1 className="font-display text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-muted-foreground">{text}</p>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}
