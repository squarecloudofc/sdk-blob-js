import { z } from "zod";

export const listObjectsSchema = z.object({
	prefix: z.string().optional(),
	continuationToken: z.string().optional(),
});

export const listObjectsPayloadSchema = listObjectsSchema
	.optional()
	.transform((params) => ({ params }));

export const listObjectResponseSchema = z.object({
	id: z.string(),
	size: z.number(),
	created_at: z.coerce.date(),
	expires_at: z.coerce.date().optional(),
});

export const listObjectsResponseSchema = z.object({
	objects: z.array(listObjectResponseSchema).default([]),
});
