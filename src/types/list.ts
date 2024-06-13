import type { z } from "zod";
import type { listObjectsResponseSchema } from "../validation/schemas/list";

export type ListObjectsResponse = z.infer<typeof listObjectsResponseSchema>;
