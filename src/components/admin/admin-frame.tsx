"use client";

import { BookOpen, Bot, Download, FileUp, Inbox, LayoutDashboard, LogOut, Menu as MenuIcon, Plus, X, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { adminApi, AdminApiError, EXPORT_URL } from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import { ThemeSwitch } from "../theme-switch";

interface AdminContextValue {
  /** The catalog version as last seen by this page (shown in the top bar). */
  version: number | null;
  setVersion: (version: number) => void;
  /** The session is gone: go to sign-in and come back to this page afterwards. */
  requireLogin: () => void;
  /** How many Món chờ duyệt are waiting (the Chờ duyệt menu badge); null until known. */
  pendingCount: number | null;
  setPendingCount: (count: number) => void;
  /** Reads the count again, after something added Món chờ duyệt elsewhere (Chạy ngay, Nhập từ file). */
  refreshPendingCount: () => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (!value) throw new Error("useAdmin must be used inside <AdminFrame>");
  return value;
}

type Status = "checking" | "ready" | "unavailable" | "offline";

/** The signed-in admin area: checks the session, then shows the top bar and the admin menu around its pages. */
export function AdminFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>("checking");
  const [version, setVersion] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

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

  // The badge count. A failure only leaves the badge out; the menu item itself still works.
  const refreshPendingCount = useCallback(() => {
    adminApi
      .listPending()
      .then((result) => setPendingCount(result.items.length))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (status === "ready") refreshPendingCount();
  }, [status, refreshPendingCount]);

  const value = useMemo(
    () => ({ version, setVersion, requireLogin, pendingCount, setPendingCount, refreshPendingCount }),
    [version, requireLogin, pendingCount, refreshPendingCount],
  );

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
      <header className="sticky top-0 z-20 h-[58px] border-b bg-background/90 backdrop-blur">
        <div className="flex h-full items-center gap-3 px-3.5 md:px-6">
          <MenuDrawer pathname={pathname} pendingCount={pendingCount} onSignOut={signOut} />
          <Image src="/icons/icon.svg" alt="" width={34} height={34} unoptimized className="size-[34px] rounded-full" />
          <span className="hidden font-display text-lg font-semibold sm:inline">Hôm nay nấu gì?</span>
          <span className="rounded-full border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">Quản trị</span>
          <span className="flex-1" />
          {version !== null && (
            <span className="rounded-full border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground max-sm:hidden">
              Danh mục v{version}
            </span>
          )}
        </div>
      </header>
      <div className="md:flex">
        <aside className="sticky top-[58px] hidden h-[calc(100dvh-58px)] w-64 shrink-0 overflow-y-auto border-r md:block">
          <AdminNav pathname={pathname} pendingCount={pendingCount} onSignOut={signOut} />
        </aside>
        <main className="mx-auto min-w-0 max-w-6xl flex-1 px-3.5 pt-6 pb-16 md:px-8 md:pt-8">{children}</main>
      </div>
    </AdminContext.Provider>
  );
}

interface NavProps {
  pathname: string;
  pendingCount: number | null;
  onSignOut: () => void;
  /** Called when a menu item is picked (the drawer closes). */
  onPick?: () => void;
}

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon; current: (path: string) => boolean }[] = [
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard, current: (path) => path === "/admin" },
  {
    href: "/admin/dishes",
    label: "Danh mục món",
    icon: BookOpen,
    current: (path) => path.startsWith("/admin/dishes") && path !== "/admin/dishes/new",
  },
  { href: "/admin/review", label: "Chờ duyệt", icon: Inbox, current: (path) => path.startsWith("/admin/review") },
  { href: "/admin/add", label: "Thêm món", icon: Plus, current: (path) => path === "/admin/add" || path === "/admin/dishes/new" },
  { href: "/admin/import", label: "Nhập từ file", icon: FileUp, current: (path) => path === "/admin/import" },
  { href: "/admin/agent", label: "Tác nhân thu thập", icon: Bot, current: (path) => path === "/admin/agent" },
];

const navItem =
  "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/** The admin menu: the sidebar on tablet and desktop, and the drawer's content on phones. */
function AdminNav({ pathname, pendingCount, onSignOut, onPick }: NavProps) {
  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <nav aria-label="Trang quản trị">
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon, current }) => {
            const here = current(pathname);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={here ? "page" : undefined}
                  onClick={onPick}
                  className={cn(navItem, here ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                >
                  <Icon aria-hidden className="size-[18px] shrink-0" />
                  <span className="flex-1">{label}</span>
                  {href === "/admin/review" && pendingCount !== null && pendingCount > 0 && (
                    <>
                      <span
                        aria-hidden
                        className="inline-grid min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground"
                      >
                        {pendingCount}
                      </span>
                      <span className="sr-only">: {pendingCount} món đang chờ</span>
                    </>
                  )}
                </Link>
              </li>
            );
          })}
          <li>
            <a href={EXPORT_URL} download onClick={onPick} className={cn(navItem, "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <Download aria-hidden className="size-[18px] shrink-0" />
              Xuất JSON
            </a>
          </li>
        </ul>
      </nav>
      <div className="mt-auto flex items-center gap-2 border-t pt-3">
        <Button variant="ghost" className="h-11 flex-1 justify-start gap-3 px-3 text-muted-foreground" onClick={onSignOut}>
          <LogOut aria-hidden className="size-[18px]" /> Đăng xuất
        </Button>
        <ThemeSwitch />
      </div>
    </div>
  );
}

/**
 * The phone menu: a "Menu" button that opens the admin menu in a drawer. It is a dialog, so focus stays
 * inside while it is open, Escape closes it and focus goes back to the button. Picking a page closes it.
 */
function MenuDrawer({ pathname, pendingCount, onSignOut }: Omit<NavProps, "onPick">) {
  const [open, setOpen] = useState(false);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button variant="outline" className="h-11 md:hidden">
          <MenuIcon aria-hidden /> Menu
          {pendingCount !== null && pendingCount > 0 && <span aria-hidden className="size-2 rounded-full bg-primary" />}
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 md:hidden" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r bg-background shadow-xl outline-none data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left md:hidden"
        >
          <div className="flex h-[58px] shrink-0 items-center justify-between border-b px-4">
            <DialogPrimitive.Title className="font-display text-lg font-semibold">Menu quản trị</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" className="size-11">
                <X aria-hidden />
                <span className="sr-only">Đóng menu</span>
              </Button>
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <AdminNav pathname={pathname} pendingCount={pendingCount} onSignOut={onSignOut} onPick={() => setOpen(false)} />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
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
