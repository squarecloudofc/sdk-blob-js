import { stringSchema } from "../schemas/common";
import { handleLiteralAssertion } from "./handlers";

export function assertString(
	value: unknown,
	code?: string,
): asserts value is string {
	handleLiteralAssertion({
		schema: stringSchema,
		expect: "string",
		value,
		code,
	});
}
