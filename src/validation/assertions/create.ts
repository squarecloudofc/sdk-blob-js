import type { CreateObjectResponse } from "../../types/create";
import { createObjectResponseSchema } from "../schemas/create";
import { handleAPIObjectAssertion } from "./handlers";

export function assertCreateObjectResponse(
	value: unknown,
): CreateObjectResponse {
	return handleAPIObjectAssertion({
		schema: createObjectResponseSchema,
		code: "CREATE_OBJECT",
		value,
	});
}
