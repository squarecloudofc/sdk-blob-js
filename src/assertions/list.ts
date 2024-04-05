import { listObjectsResponseSchema } from "../schemas/list";
import type { ListObjectsResponse } from "../types/list";
import { handleAPIObjectAssertion } from "./handlers";

export function assertListObjectsResponse(value: unknown): ListObjectsResponse {
	return handleAPIObjectAssertion({
		schema: listObjectsResponseSchema,
		code: "LIST_OBJECTS",
		route: "/list",
		value,
	});
}