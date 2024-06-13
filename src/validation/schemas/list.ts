import { z } from "zod";

export const listObjectSchema = z.object({
	id: z.string(),
	size: z.number(),
	created_at: z.coerce.date(),
	expires_at: z.coerce.date().optional(),
});

export const listObjectsResponseSchema = z.object({
	objects: z.array(listObjectSchema),
});
