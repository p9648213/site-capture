import { z } from "zod";

export const createSiteSchema = z.object({
  name: z.string().trim().min(1),
  address: z.string().trim().min(1),
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
});

export const adminLoginSchema = z.object({
  password: z.string().min(1),
});
