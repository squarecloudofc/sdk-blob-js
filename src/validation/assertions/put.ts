import type { PutObjectResponse } from "../../types/put";
import { putObjectResponseSchema } from "../schemas/put";
import { handleAPIObjectAssertion } from "./handlers";

export function assertPutObjectResponse(value: unknown): PutObjectResponse {
	return handleAPIObjectAssertion({
		schema: putObjectResponseSchema,
		code: "PUT_OBJECT",
		route: "/put",
		value,
	});
}