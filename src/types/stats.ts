import type { z } from "zod";
import type { statsResponseSchema } from "../validation/schemas/stats";

export type StatsResponse = z.infer<typeof statsResponseSchema>;
