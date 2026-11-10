"use client";

import { ArrowRight, Camera, FileUp, PenLine } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import type { PendingDish } from "@/shared/schemas";
import { useAdmin } from "./admin-frame";
import { MenuCard } from "./menu-card";

/**
 * Thêm món (spec #41): every way to add a dish on one page. Ảnh thực đơn and Gõ tên món have the AI
 * write the recipe into Chờ duyệt; Tự nhập công thức is the hand-written form, published straight away.
 */
export function AddScreen() {
  const { requireLogin, refreshPendingCount } = useAdmin();
  const [pending, setPending] = useState<PendingDish[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => heading.current?.focus(), []);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .listPending()
      .then((result) => {
        if (cancelled) return;
        setPending(result.items);
        setConfigured(result.readerConfigured);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof AdminApiError && error.status === 401) requireLogin();
        // Otherwise the card still works; typed names simply start ticked.
      });
    return () => {
      cancelled = true;
    };
  }, [requireLogin]);

  function created(item: PendingDish) {
    setPending((current) => [item, ...(current ?? [])]);
    refreshPendingCount();
  }

  return (
    <div>
      <div className="mb-5">
        <h1 ref={heading} tabIndex={-1} className="font-display text-3xl font-semibold outline-none">
          Thêm món
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Chọn một cách để thêm món vào Danh mục món.</p>
      </div>

      <ul className="mb-6 grid gap-3 md:grid-cols-3">
        <Way icon={<Camera aria-hidden className="size-5" />} href="#upload-title" title="Ảnh thực đơn hoặc gõ tên món">
          AI viết công thức, món vào Chờ duyệt để bạn kiểm tra.
        </Way>
        <Way icon={<PenLine aria-hidden className="size-5" />} href="/admin/dishes/new" title="Tự nhập công thức">
          Bạn tự viết công thức. Món được đăng ngay, không qua Chờ duyệt.
        </Way>
        <Way icon={<FileUp aria-hidden className="size-5" />} href="/admin/import" title="Nhập từ file">
          Nhiều món một lúc từ một file JSON. Món vào Chờ duyệt.
        </Way>
      </ul>

      <MenuCard configured={configured} pending={pending ?? []} onConfigured={setConfigured} onCreated={created} />
    </div>
  );
}

function Way({ icon, href, title, children }: { icon: ReactNode; href: string; title: string; children: ReactNode }) {
  const body = (
    <>
      <span className="flex items-center gap-2 font-display text-base font-semibold">
        {icon} {title}
        <ArrowRight aria-hidden className="ml-auto size-4 text-muted-foreground" />
      </span>
      <span className="mt-1 block text-sm text-muted-foreground">{children}</span>
    </>
  );
  const className =
    "block h-full rounded-2xl border bg-card p-4 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50";
  return (
    <li>
      {href.startsWith("#") ? (
        <a href={href} className={className}>
          {body}
        </a>
      ) : (
        <Link href={href} className={className}>
          {body}
        </Link>
      )}
    </li>
  );
}
