"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  EMPTY_PERSONAL_STATE,
  localDateString,
  reduce,
  resolveCatalog,
  type Action,
  type Notice,
  type PersonalState,
  type ResolvedCatalog,
} from "@/domain";
import {
  BUNDLED_CATALOG,
  loadCatalog,
  refreshCatalog,
  saveCatalog,
  type CachedCatalog,
} from "@/lib/catalog-client";
import { trackEvents } from "@/lib/analytics";
import { noticeMessage } from "@/lib/notices";
import { loadPersonal, savePersonal } from "@/lib/personal-store";

interface AppContextValue {
  /** False until the on-device data has loaded (render a skeleton, not an empty state). */
  ready: boolean;
  state: PersonalState;
  catalog: ResolvedCatalog;
  today: string;
  /** Applies an action; returns the notice it produced (also shown as a toast), if any. */
  dispatch: (action: Action) => Notice | undefined;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside <AppProvider>");
  return value;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<PersonalState>(EMPTY_PERSONAL_STATE);
  const [catalogData, setCatalogData] = useState<CachedCatalog>(BUNDLED_CATALOG);
  const [today, setToday] = useState(() => localDateString(new Date()));

  // The reducer is pure; these refs let `dispatch` stay stable and read the latest values.
  const stateRef = useRef(state);
  const catalogRef = useRef<ResolvedCatalog | null>(null);
  const todayRef = useRef(today);

  const catalog = useMemo(() => resolveCatalog(catalogData.dishes), [catalogData]);

  useEffect(() => {
    catalogRef.current = catalog;
    todayRef.current = today;
    stateRef.current = state;
  });

  const dispatch = useCallback((action: Action) => {
    const resolved = catalogRef.current;
    if (!resolved) return undefined;
    const result = reduce(stateRef.current, action, {
      catalog: resolved,
      newId: () => crypto.randomUUID(),
      now: Date.now(),
      today: todayRef.current,
    });
    if (result.state !== stateRef.current) {
      stateRef.current = result.state;
      setState(result.state);
      void savePersonal(result.state);
    }
    trackEvents(result.events);
    if (result.notice) toast(noticeMessage(result.notice));
    return result.notice;
  }, []);

  // Boot: load the device's data, then show the catalog from the cache (or the bundled seed)
  // immediately and refresh it from the server in the background.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [personal, cached] = await Promise.all([loadPersonal(), loadCatalog()]);
      if (cancelled) return;
      stateRef.current = personal;
      catalogRef.current = resolveCatalog(cached.dishes);
      setState(personal);
      setCatalogData(cached);
      setReady(true);

      const refreshed = await refreshCatalog(cached);
      if (cancelled || refreshed.status !== "updated") return;
      setCatalogData(refreshed.catalog);
      void saveCatalog(refreshed.catalog);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // A new local day gets a new menu: check when the app returns to the foreground.
  useEffect(() => {
    const refreshDay = () => {
      if (document.visibilityState === "visible") setToday(localDateString(new Date()));
    };
    document.addEventListener("visibilitychange", refreshDay);
    window.addEventListener("focus", refreshDay);
    return () => {
      document.removeEventListener("visibilitychange", refreshDay);
      window.removeEventListener("focus", refreshDay);
    };
  }, []);

  useEffect(() => {
    if (ready) dispatch({ type: "ensure-today" });
  }, [ready, today, dispatch]);

  const value = useMemo(
    () => ({ ready, state, catalog, today, dispatch }),
    [ready, state, catalog, today, dispatch],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
