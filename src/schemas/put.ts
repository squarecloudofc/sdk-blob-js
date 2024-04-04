import { z } from "zod";
import { nameLikeStringSchema } from "./common";

export const putBlobObjectSchema = z.object({
	/** A string representing the name for the file. */
	name: nameLikeStringSchema,
	/** Use absolute path or Buffer, can be a single file or compressed (zip) */
	file: z.string().or(z.instanceof(Buffer)),
	/** A string representing the prefix for the file. */
	prefix: nameLikeStringSchema.optional(),
	/** A number indicating the expiration period of the file, ranging from 1 to 365 days. */
	expire: z.number().min(1).max(365).optional(),
	/** Set to true if a security hash is required. */
	securityHash: z.boolean().optional(),
	/** Set to true if the file should be set for automatic download. */
	autoDownload: z.boolean().optional(),
});

export const putBlobObjectPayloadSchema = putBlobObjectSchema.transform(
	({ file, securityHash, autoDownload, ...rest }) => ({
		file,
		params: {
			...rest,
			security_hash: securityHash,
			auto_download: autoDownload,
		},
	}),
);

export const putBlobObjectResponseSchema = z.object({
	/** The URL of the uploaded file. (File distributed in Square Cloud CDN) */
	url: z.string(),
});
