import { z } from "zod";

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
] as const;

/** One thing wrong with a submitted dish: the rule that failed and where (the UI words it). */
export const dishIssueSchema = z.object({
  code: z.enum([
    "name-required",
    "name-duplicate",
    "category-required",
    "category-not-allowed",
    "ingredients-required",
    "time-invalid",
    "chay-toi",
  ]),
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
export type AdminDish = z.infer<typeof adminDishSchema>;
export type AdminCatalogResponse = z.infer<typeof adminCatalogResponseSchema>;
export type DishDraftInput = z.infer<typeof dishDraftSchema>;
export type AdminDishResponse = z.infer<typeof adminDishResponseSchema>;
export type DishIssue = z.infer<typeof dishIssueSchema>;
export type CatalogResponse = z.infer<typeof catalogResponseSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];
export type HealthResponse = z.infer<typeof healthResponseSchema>;
