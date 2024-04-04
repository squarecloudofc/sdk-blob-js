import type { ZodSchema } from "zod";

export type BaseAssertionProps = {
	schema: ZodSchema;
	value: unknown;
	code?: string;
};

export type LiteralAssertionProps = BaseAssertionProps & {
	expect: string;
};

export type APIObjectAssertionProps = BaseAssertionProps & {
	code: string;
	route: string;
};
