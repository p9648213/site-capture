import { z } from "zod";

export const createSiteSchema = z.object({
  name: z.string().trim().min(1),
  siteId: z.string().trim().min(1),
});

export const updateSiteSchema = createSiteSchema.partial();

export const createCategorySchema = z.object({
  siteId: z.number().int().positive(),
  name: z.string().trim().min(1),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1).optional(),
});

export const createPictureTypeSchema = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().trim().min(1),
});

export const updatePictureTypeSchema = z.object({
  name: z.string().trim().min(1).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const movePictureTypeSchema = z.object({
  direction: z.enum(["up", "down"]),
});

export const reorderPictureTypesSchema = z.object({
  pictureTypeIds: z.array(z.number().int().positive()).min(1),
});

export const adminLoginSchema = z.object({
  password: z.string().min(1),
});
