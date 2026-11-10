import type { DishDraft } from "@/domain";
import {
  adminCatalogResponseSchema,
  adminDishResponseSchema,
  agentRunResponseSchema,
  agentRunsResponseSchema,
  agentSettingsResponseSchema,
  apiErrorSchema,
  bulkApproveResponseSchema,
  dishFileImportResponseSchema,
  menuReadingResponseSchema,
  pendingDishResponseSchema,
  pendingListResponseSchema,
  type AdminCatalogResponse,
  type AgentRun,
  type AgentRunsResponse,
  type AgentSettingsView,
  type BulkApproveResponse,
  type DishFileImportResponse,
  type PendingDish,
  type MenuReadingResponse,
  type PendingListResponse,
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
    /** Cài đặt tác nhân: the settings the server found out of range. */
    readonly fields: string[] = [],
    /** Nhập từ file: why the server refused the file. */
    readonly refusal?: string,
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
      const { code, message, issues, lockedUntil, fields, refusal } = parsed.data.error;
      throw new AdminApiError(response.status, code, message, issues, lockedUntil, fields, refusal);
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

  // Món chờ duyệt
  async listPending(): Promise<PendingListResponse> {
    return pendingListResponseSchema.parse(await call("/pending"));
  },
  /** Reads the dish names off an Ảnh thực đơn. `photos` are data URLs, already shrunk on this device. Stores nothing. */
  async readMenu(photos: string[]): Promise<MenuReadingResponse> {
    return menuReadingResponseSchema.parse(await call("/pending/menu", { method: "POST", body: { photos } }));
  },
  /** Has the AI write the recipe for one name; it becomes a Món chờ duyệt. */
  async writeDish(name: string): Promise<PendingDish> {
    return pendingDishResponseSchema.parse(await call("/pending/dishes", { method: "POST", body: { name } })).pending;
  },
  async getPending(id: string): Promise<PendingDish> {
    return pendingDishResponseSchema.parse(await call(`/pending/${encodeURIComponent(id)}`)).pending;
  },
  async updatePending(id: string, draft: DishDraft): Promise<PendingDish> {
    return pendingDishResponseSchema.parse(await call(`/pending/${encodeURIComponent(id)}`, { method: "PUT", body: draft })).pending;
  },
  async discardPending(id: string): Promise<void> {
    await call(`/pending/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
  /** Duyệt: publishes the (edited) draft as a dish. */
  async approvePending(id: string, draft: DishDraft): Promise<AdminDishResponse> {
    return adminDishResponseSchema.parse(await call(`/pending/${encodeURIComponent(id)}/approve`, { method: "POST", body: draft }));
  },

  /** Nhập từ file: the server reads the file again and adds the dishes it can to Chờ duyệt. */
  async importFile(fileName: string, text: string): Promise<DishFileImportResponse> {
    return dishFileImportResponseSchema.parse(await call("/pending/import", { method: "POST", body: { fileName, text } }));
  },
  /** Bulk Duyệt: each Món chờ duyệt as it is stored. */
  async approveMany(ids: string[]): Promise<BulkApproveResponse> {
    return bulkApproveResponseSchema.parse(await call("/pending/approve", { method: "POST", body: { ids } }));
  },

  // Tác nhân thu thập
  async listRuns(): Promise<AgentRunsResponse> {
    return agentRunsResponseSchema.parse(await call("/agent/runs"));
  },
  /** Chạy ngay: resolves when the run is done (it can take a few minutes). */
  async startRun(): Promise<AgentRun> {
    return agentRunResponseSchema.parse(await call("/agent/runs", { method: "POST", body: {} })).run;
  },
  async getAgentSettings(): Promise<AgentSettingsView> {
    return agentSettingsResponseSchema.parse(await call("/agent/settings")).settings;
  },
  async saveAgentSettings(settings: AgentSettingsView): Promise<AgentSettingsView> {
    return agentSettingsResponseSchema.parse(await call("/agent/settings", { method: "PUT", body: settings })).settings;
  },
};
