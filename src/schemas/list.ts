import { z } from "zod";

export const listObjectSchema = z.object({
	name: z.string(),
	size: z.number(),
	created_at: z.coerce.date(),
	expire_at: z.coerce.date().optional(),
});

export const listObjectsResponseSchema = z.array(listObjectSchema);
