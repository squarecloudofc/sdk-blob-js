import type { ZodIssue } from "zod";
import {
	SquareCloudBlobError,
	SquareCloudValidationError,
} from "../structures/error";
import type {
	APIObjectAssertionProps,
	LiteralAssertionProps,
} from "../types/assertions";

export function handleLiteralAssertion({
	schema,
	value,
	expect,
	code,
}: LiteralAssertionProps) {
	try {
		schema.parse(value);
	} catch {
		throw new SquareCloudValidationError(
			code ? `INVALID_${code}` : "VALIDATION_ERROR",
			`Expect ${expect}, got ${typeof value}`,
		);
	}
}

export function handleAPIObjectAssertion({
	schema,
	value,
	code,
	route,
}: APIObjectAssertionProps) {
	const name = code.toLowerCase().replaceAll("_", " ");

	try {
		return schema.parse(value);
	} catch (err) {
		const cause = err.errors?.map((err: ZodIssue) => ({
			...err,
			path: err.path.join(" > "),
		}));

		throw new SquareCloudBlobError(
			`INVALID_API_${code}`,
			`Invalid ${name} object received from API ${route}`,
			{ cause },
		);
	}
}
