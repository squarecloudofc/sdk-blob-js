import { putBlobObjectResponseSchema } from "../schemas/put";
import type { PutBlobObjectResponse } from "../types/put";
import { handleAPIObjectAssertion } from "./handlers";

export function assertPutBlobObjectResponse(
	value: unknown,
): PutBlobObjectResponse {
	return handleAPIObjectAssertion({
		schema: putBlobObjectResponseSchema,
		code: "PUT_OBJECT",
		route: "/put",
		value,
	});
}
