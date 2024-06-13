import type { z } from "zod";
import type {
	listObjectsResponseSchema,
	listObjectsSchema,
} from "../validation/schemas/list";

export type ListObjectsType = z.infer<typeof listObjectsSchema>;
export type ListObjectsResponse = z.infer<typeof listObjectsResponseSchema>;
