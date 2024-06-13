import { z } from "zod";

export const statsResponseSchema = z.object({
	/** The total number of objects in your account. */
	objects: z.number(),
	/** The total size of all objects in your account, in bytes. */
	size: z.number(),
	/** The total price of storage for all objects in your account, in BRL. */
	storagePrice: z.number(),
	/** The total price of all objects in your account, in BRL. */
	objectsPrice: z.number(),
	/** The total price of all objects in your account, in BRL. */
	totalEstimate: z.number(),
});
