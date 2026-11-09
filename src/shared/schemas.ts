import { z } from "zod";
import { DISH_PROBLEM_CODES } from "@/domain/dish-rules";
import type { RunEntry } from "@/domain/collector";
import { PENDING_SOURCE_KINDS } from "@/domain/pending-dish";

// Shared by the Route Handlers (outgoing) and the client (incoming), so server and client cannot
// drift and a bad payload can never reach the on-device store.

export const mealTypeSchema = z.enum(["buacom", "buatomonuoc"]);
export const categorySchema = z.enum(["xao", "canh", "man"]);
export const regionSchema = z.enum(["bac", "trung", "nam"]);

const dishFields = z.object({
  id: z.string().min(1),
  mealType: mealTypeSchema,
  category: categorySchema.nullable(),
  chay: z.boolean(),
  region: regionSchema.nullable(),
  name: z.string().min(1),
  time: z.number().int().positive().nullable(),
  ingredients: z.array(z.string().min(1)).min(1),
  steps: z.array(z.string().min(1)),
  retired: z.boolean().default(false),
});

export const dishSchema = dishFields.superRefine((dish, ctx) => {
    // Mirrors the database CHECK constraint.
    if (dish.mealType === "buacom" && dish.category === null) {
      ctx.addIssue({ code: "custom", path: ["category"], message: "Bữa cơm 3 món needs a Nhóm món" });
    }
    if (dish.mealType === "buatomonuoc" && dish.category !== null) {
      ctx.addIssue({ code: "custom", path: ["category"], message: "Bữa 1 món has no Nhóm món" });
    }
  });

/** What the admin form submits. Structure only: the business rules (tỏi, duplicate names...) are domain rules. */
export const dishDraftSchema = z.object({
  mealType: mealTypeSchema,
  category: categorySchema.nullable(),
  chay: z.boolean(),
  region: regionSchema.nullable(),
  name: z.string(),
  time: z.number().nullable(),
  ingredients: z.array(z.string()),
  steps: z.array(z.string()),
});

export const catalogResponseSchema = z.object({
  /** Increases only when seed content actually changes. */
  version: z.number().int().min(0),
  /** Every dish, including retired ones (flagged), so history and favorites keep resolving. */
  dishes: z.array(dishSchema),
});

export const API_ERROR_CODES = [
  "method_not_allowed",
  "catalog_unavailable",
  "internal_error",
  // Admin API
  "admin_unavailable",
  "unauthorized",
  "invalid_credentials",
  "locked",
  "forbidden_origin",
  "unsupported_media_type",
  "bad_request",
  "validation_failed",
  "not_found",
  // Món chờ duyệt (Ảnh thực đơn)
  "payload_too_large",
  "unreadable",
  "no_dishes",
  "unusable_answer",
  "reader_not_configured",
  "reader_unavailable",
  "reader_rate_limited",
  // Tác nhân thu thập
  "agent_running",
] as const;

/** One thing wrong with a submitted dish: the rule that failed and where (the UI words it). */
export const dishIssueSchema = z.object({
  code: z.enum(DISH_PROBLEM_CODES),
  field: z.enum(["name", "category", "ingredients", "steps", "time"]),
  index: z.number().int().min(0).optional(),
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(API_ERROR_CODES),
    message: z.string(),
    /** `locked`: when sign-in opens again (ISO time). */
    lockedUntil: z.string().optional(),
    /** `validation_failed`: every problem with the submitted dish. */
    issues: z.array(dishIssueSchema).optional(),
    /** `bad_request` on Cài đặt tác nhân: the settings that are out of range. */
    fields: z.array(z.enum(["dishesPerDay", "pauseAt", "pagesPerRun"])).optional(),
  }),
});

export const healthResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  database: z.enum(["up", "down"]),
});

/** A dish as the admin sees it: the public fields plus when it was last changed (never sent to devices). */
export const adminDishSchema = dishFields.extend({ updatedAt: z.string() });
export const adminCatalogResponseSchema = z.object({
  version: z.number().int().min(0),
  dishes: z.array(adminDishSchema),
});
/** A saved dish and the catalog version that now contains it. */
export const adminDishResponseSchema = z.object({ version: z.number().int().min(0), dish: adminDishSchema });
/** What the admin page sends to have an Ảnh thực đơn read: 1–4 images of ONE menu, as data URLs. */
export const MAX_PHOTOS = 4;
export const photoUploadSchema = z.object({
  photos: z
    .array(z.string().regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/))
    .min(1)
    .max(MAX_PHOTOS),
});

/** What the admin page sends to have one dish written from a name (Ảnh thực đơn). Checked again by the domain. */
export const writeDishSchema = z.object({ name: z.string() });

export const nameMatchSchema = z.object({
  of: z.enum(["dish", "pending"]),
  id: z.string(),
  name: z.string(),
  hidden: z.boolean(),
});

/** The dish names read off an Ảnh thực đơn, each with whether it starts ticked. Nothing is stored. */
export const menuReadingResponseSchema = z.object({
  model: z.string(),
  names: z.array(z.object({ name: z.string(), ticked: z.boolean(), match: nameMatchSchema.nullable() })),
});

export const pendingWarningSchema = z.discriminatedUnion("code", [
  z.object({ code: z.literal("ai-written") }),
  z.object({ code: z.literal("chay-toi") }),
  z.object({
    code: z.literal("possible-duplicate"),
    of: z.enum(["dish", "pending"]),
    id: z.string(),
    name: z.string(),
    hidden: z.boolean(),
  }),
]);

/**
 * A Món chờ duyệt as the admin sees it. Looser than a dish (a proposal may be incomplete); Duyệt
 * runs the full dish rules. `warnings` are derived from the catalog as it is now.
 */
export const pendingDishSchema = z.object({
  id: z.string().min(1),
  source: z.object({ kind: z.enum(PENDING_SOURCE_KINDS), url: z.string().nullable() }),
  model: z.string().nullable(),
  mealType: mealTypeSchema,
  category: categorySchema.nullable(),
  chay: z.boolean(),
  region: regionSchema.nullable(),
  name: z.string(),
  time: z.number().int().positive().nullable(),
  ingredients: z.array(z.string()),
  steps: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  warnings: z.array(pendingWarningSchema),
});
export const pendingDishResponseSchema = z.object({ pending: pendingDishSchema });
export const pendingListResponseSchema = z.object({
  /** Newest first. */
  items: z.array(pendingDishSchema),
  /** Whether the AI model can be asked at all (an OpenRouter key is set). */
  readerConfigured: z.boolean(),
});
export type PendingDish = z.infer<typeof pendingDishSchema>;
export type PendingWarningView = z.infer<typeof pendingWarningSchema>;
export type PendingListResponse = z.infer<typeof pendingListResponseSchema>;
export type MenuReadingResponse = z.infer<typeof menuReadingResponseSchema>;

export type AdminDish = z.infer<typeof adminDishSchema>;
export type AdminCatalogResponse = z.infer<typeof adminCatalogResponseSchema>;
export type DishDraftInput = z.infer<typeof dishDraftSchema>;
export type AdminDishResponse = z.infer<typeof adminDishResponseSchema>;
export type DishIssue = z.infer<typeof dishIssueSchema>;
export type CatalogResponse = z.infer<typeof catalogResponseSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];
export type HealthResponse = z.infer<typeof healthResponseSchema>;

// --- Tác nhân thu thập (spec B, #31) ---

export const agentSettingsSchema = z.object({
  dishesPerDay: z.number().int(),
  pauseAt: z.number().int(),
  pagesPerRun: z.number().int(),
});
export const agentSettingsResponseSchema = z.object({ settings: agentSettingsSchema });

export const runEntrySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("skip"),
    reason: z.enum(["duplicate", "not_a_recipe", "unreadable", "not_kept", "robots"]),
    sourceId: z.string(),
    url: z.string().optional(),
  }),
  z.object({
    kind: z.literal("error"),
    reason: z.enum(["source", "layout", "page", "reader", "crash"]),
    sourceId: z.string(),
    url: z.string().optional(),
  }),
]) satisfies z.ZodType<RunEntry>;
export const agentRunSchema = z.object({
  id: z.string().min(1),
  trigger: z.enum(["cron", "manual"]),
  status: z.enum(["ok", "skipped", "partial", "failed"]),
  skipped: z.enum(["paused", "too_many_waiting"]).nullable(),
  stoppedBy: z.enum(["rate_limited", "not_configured", "deadline"]).nullable(),
  pagesRead: z.number().int().min(0),
  added: z.number().int().min(0),
  entries: z.array(runEntrySchema),
  startedAt: z.string(),
  finishedAt: z.string(),
});
export const agentRunResponseSchema = z.object({ run: agentRunSchema });
export const agentRunsResponseSchema = z.object({
  /** Newest first, at most ~30. */
  runs: z.array(agentRunSchema),
  /** Whether a run is going right now. */
  running: z.boolean(),
});
export type AgentSettingsView = z.infer<typeof agentSettingsSchema>;
export type AgentRun = z.infer<typeof agentRunSchema>;
export type AgentRunsResponse = z.infer<typeof agentRunsResponseSchema>;
