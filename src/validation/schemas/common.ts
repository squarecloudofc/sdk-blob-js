import { z } from "zod";

export const stringSchema = z.string();

export const nameLikeSchema = z
	.string()
	.min(3)
	.max(32)
	.regex(/^[a-zA-Z0-9_]{3,32}$/, {
		message: "Name must contain only letters, numbers and _",
	});
