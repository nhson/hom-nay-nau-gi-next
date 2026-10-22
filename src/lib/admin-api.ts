import type { DishDraft } from "@/domain";
import {
  adminCatalogResponseSchema,
  adminDishResponseSchema,
  apiErrorSchema,
  type AdminCatalogResponse,
  type AdminDishResponse,
  type DishIssue,
} from "@/shared/schemas";

/** A failed admin API call. `status` 0 means the network itself failed. */
export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly issues: DishIssue[] = [],
    readonly lockedUntil?: string,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

export const EXPORT_URL = "/api/v1/admin/export";

async function call(path: string, init: { method?: string; body?: unknown } = {}): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`/api/v1/admin${path}`, {
      method: init.method,
      credentials: "same-origin",
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new AdminApiError(0, "network", "Không kết nối được máy chủ.");
  }
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(await response.json().catch(() => null));
    if (parsed.success) {
      const { code, message, issues, lockedUntil } = parsed.data.error;
      throw new AdminApiError(response.status, code, message, issues, lockedUntil);
    }
    throw new AdminApiError(response.status, "internal_error", `Lỗi máy chủ (${response.status}).`);
  }
  return response.json();
}

export const adminApi = {
  async session(): Promise<void> {
    await call("/session");
  },
  async login(passphrase: string): Promise<void> {
    await call("/session", { method: "POST", body: { passphrase } });
  },
  async logout(): Promise<void> {
    await call("/session", { method: "DELETE" });
  },
  async listDishes(): Promise<AdminCatalogResponse> {
    return adminCatalogResponseSchema.parse(await call("/dishes"));
  },
  async createDish(draft: DishDraft): Promise<AdminDishResponse> {
    return adminDishResponseSchema.parse(await call("/dishes", { method: "POST", body: draft }));
  },
  async updateDish(id: string, draft: DishDraft): Promise<AdminDishResponse> {
    return adminDishResponseSchema.parse(await call(`/dishes/${encodeURIComponent(id)}`, { method: "PUT", body: draft }));
  },
  async setHidden(id: string, retired: boolean): Promise<AdminDishResponse> {
    return adminDishResponseSchema.parse(
      await call(`/dishes/${encodeURIComponent(id)}`, { method: "PATCH", body: { retired } }),
    );
  },
};
