"use client";

import { ChevronDown, Share, Smartphone, SquarePlus, X } from "lucide-react";
import { useId, useState, useSyncExternalStore } from "react";
import { detectInstallPlatform, installHintVisible, type InstallPlatform } from "@/domain";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useApp } from "../app-provider";

interface BrowserState {
  platform: InstallPlatform;
  standalone: boolean;
}

const STANDALONE_QUERY = "(display-mode: standalone)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(STANDALONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** A primitive snapshot ("ios:tab") so React can compare it; null on the server (no window to ask). */
function getSnapshot(): string {
  const platform = detectInstallPlatform({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
  });
  // `navigator.standalone` is iOS's own flag, set when launched from the Home Screen.
  const standalone =
    window.matchMedia(STANDALONE_QUERY).matches || (navigator as { standalone?: boolean }).standalone === true;
  return `${platform}:${standalone ? "standalone" : "tab"}`;
}

function useBrowserState(): BrowserState | null {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => null);
  if (snapshot === null) return null;
  const [platform, mode] = snapshot.split(":");
  return { platform: platform as InstallPlatform, standalone: mode === "standalone" };
}

/** A tiny stand-in for an iOS button, so people can recognise the icon they are told to tap. */
function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="inline-flex size-6 items-center justify-center rounded-lg border bg-card align-[-6px] text-primary [&_svg]:size-3.5"
    >
      {children}
    </span>
  );
}

/**
 * iOS never offers to install a web app: the only way is Share -> Thêm vào MH chính. This explains
 * it once, on iPhone/iPad in a browser tab, until the person dismisses it (stored on the device).
 */
export function InstallHint() {
  const { ready, state, dispatch } = useApp();
  const browser = useBrowserState();
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  if (!ready || !browser) return null;
  if (!installHintVisible({ ...browser, dismissed: state.installHintDismissed })) return null;

  const dismiss = () => dispatch({ type: "dismiss-install-hint" });

  return (
    <section
      aria-label="Cài app lên màn hình chính"
      className="relative mb-4 rounded-2xl border border-turmeric/45 bg-turmeric/15 p-1.5 pl-3"
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label="Ẩn gợi ý, không hiện lại"
        className="absolute top-0.5 right-0.5 text-muted-foreground"
        onClick={dismiss}
      >
        <X aria-hidden />
      </Button>

      <div className="flex min-h-[52px] items-center gap-2.5 pr-11">
        <span
          aria-hidden
          className="grid size-[34px] shrink-0 place-items-center rounded-[10px] bg-turmeric text-turmeric-foreground"
        >
          <Smartphone className="size-[18px]" />
        </span>
        <p className="flex-1 text-sm leading-snug font-semibold">Cài app lên màn hình chính</p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {open ? "Thu gọn" : "Xem cách"}
          <ChevronDown aria-hidden className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      <div id={bodyId} hidden={!open} className="pr-2 pb-2">
        <ol className="grid gap-2 text-sm">
          <li className="flex items-center gap-2.5">
            <Step n={1} />
            <span>
              Bấm nút Chia sẻ{" "}
              <Glyph>
                <Share />
              </Glyph>
            </span>
          </li>
          <li className="flex items-center gap-2.5">
            <Step n={2} />
            <span>
              Chọn{" "}
              <Glyph>
                <SquarePlus />
              </Glyph>{" "}
              <b className="font-semibold">Thêm vào MH chính</b>
            </span>
          </li>
          <li className="flex items-center gap-2.5">
            <Step n={3} />
            <span>
              Bấm <b className="font-semibold">Thêm</b>
            </span>
          </li>
        </ol>
        <p className="mt-3 border-t border-dashed border-turmeric/40 pt-2.5 text-[0.8125rem] text-muted-foreground">
          Không thấy mục này? Cuộn xuống, hoặc mở trang bằng Safari.
        </p>
        <div className="mt-3 flex justify-end">
          <Button onClick={dismiss}>Đã hiểu</Button>
        </div>
      </div>
    </section>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="grid size-6 shrink-0 place-items-center rounded-full border bg-card text-xs font-bold text-turmeric-text"
    >
      {n}
    </span>
  );
}
