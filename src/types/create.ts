import type { z } from "zod";
import type {
	createObjectResponseSchema,
	createObjectSchema,
} from "../validation/schemas/create";

export type CreateObjectType = z.infer<typeof createObjectSchema>;
export type CreateObjectResponse = z.infer<typeof createObjectResponseSchema>;
