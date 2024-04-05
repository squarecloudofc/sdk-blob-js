import type { z } from "zod";
import type { listObjectsResponseSchema } from "../schemas/list";

export type ListObjectsResponse = z.infer<typeof listObjectsResponseSchema>;
