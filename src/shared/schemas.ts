import { z } from "zod";

// Shared by the Route Handlers (outgoing) and the client (incoming), so server and client cannot
// drift and a bad payload can never reach the on-device store.

export const mealTypeSchema = z.enum(["buacom", "buatomonuoc"]);
export const categorySchema = z.enum(["xao", "canh", "man"]);
export const regionSchema = z.enum(["bac", "trung", "nam"]);

export const dishSchema = z
  .object({
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
  })
  .superRefine((dish, ctx) => {
    // Mirrors the database CHECK constraint.
    if (dish.mealType === "buacom" && dish.category === null) {
      ctx.addIssue({ code: "custom", path: ["category"], message: "Bữa cơm 3 món needs a Nhóm món" });
    }
    if (dish.mealType === "buatomonuoc" && dish.category !== null) {
      ctx.addIssue({ code: "custom", path: ["category"], message: "Bữa 1 món has no Nhóm món" });
    }
  });

export const catalogResponseSchema = z.object({
  /** Increases only when seed content actually changes. */
  version: z.number().int().min(0),
  /** Every dish, including retired ones (flagged), so history and favorites keep resolving. */
  dishes: z.array(dishSchema),
});

export const API_ERROR_CODES = ["method_not_allowed", "catalog_unavailable", "internal_error"] as const;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(API_ERROR_CODES),
    message: z.string(),
  }),
});

export const healthResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  database: z.enum(["up", "down"]),
});

export type CatalogResponse = z.infer<typeof catalogResponseSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];
export type HealthResponse = z.infer<typeof healthResponseSchema>;
