import type { z } from "zod";
import type { putObjectResponseSchema, putObjectSchema } from "../schemas/put";

export type PutObjectType = z.infer<typeof putObjectSchema>;
export type PutObjectResponse = z.infer<typeof putObjectResponseSchema>;
