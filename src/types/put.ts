import type { z } from "zod";
import type {
	putBlobObjectResponseSchema,
	putBlobObjectSchema,
} from "../schemas/put";

export type PutBlobObjectType = z.infer<typeof putBlobObjectSchema>;
export type PutBlobObjectResponse = z.infer<typeof putBlobObjectResponseSchema>;
