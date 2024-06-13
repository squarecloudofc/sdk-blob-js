import type { StatsResponse } from "../../types/stats";
import { statsResponseSchema } from "../schemas/stats";
import { handleAPIObjectAssertion } from "./handlers";

export function assertStatsResponse(value: unknown): StatsResponse {
	return handleAPIObjectAssertion({
		schema: statsResponseSchema,
		code: "ACCOUNT_STATS",
		value,
	});
}
