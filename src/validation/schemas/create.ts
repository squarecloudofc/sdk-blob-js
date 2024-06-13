import { z } from "zod";
import { MimeTypeUtil } from "../../utils/mimetype";
import { nameLikeSchema } from "./common";

export const createObjectSchema = z
	.object({
		/** A string representing the name for the file. */
		name: nameLikeSchema,
		/** Use absolute path, Buffer or Blob */
		file: z.string().or(z.instanceof(Buffer)),
		/** A string representing the MIME type of the file. */
		mimeType: z.enum(MimeTypeUtil.mimeTypes).optional(),
		/** A string representing the prefix for the file. */
		prefix: nameLikeSchema.optional(),
		/** A number indicating the expiration period of the file, ranging from 1 to 365 days. */
		expire: z.number().min(1).max(365).optional(),
		/** Set to true if a security hash is required. */
		securityHash: z.boolean().optional(),
		/** Set to true if the file should be set for automatic download. */
		autoDownload: z.boolean().optional(),
	})
	.refine(({ file, mimeType }) => !(file instanceof Buffer && !mimeType), {
		message: "mimeType is required if file is a Buffer",
		path: ["mimeType"],
	});

export const createObjectPayloadSchema = createObjectSchema.transform(
	({ file, securityHash, autoDownload, ...rest }) => ({
		file,
		params: {
			...rest,
			security_hash: securityHash,
			auto_download: autoDownload,
		},
	}),
);

export const createObjectResponseSchema = z.object({
	/** The id of the uploaded file. */
	id: z.string(),
	/** The name of the uploaded file. */
	name: z.string(),
	/** The prefix of the uploaded file. */
	prefix: z.string().optional(),
	/** The size of the uploaded file. */
	size: z.number(),
	/** The URL of the uploaded file. (File distributed in Square Cloud CDN) */
	url: z.string(),
});
