import type { MimeTypes } from "../utils/mimetype";

export type CreateObjectOptions = {
	/**
	 * A string representing the name of the file.
	 * Must adhere to the a to z, A to Z, 0 to 9, and _ pattern. (3 to 32 characters)
	 */
	name: string;
	/** Use absolute path, Buffer or Blob */
	file: string | Buffer;
	/**
	 * A string representing the prefix for the file.
	 * Must adhere to the a to z, A to Z, 0 to 9, and _ pattern. (3 to 32 characters)
	 */
	prefix?: string;
	/** A string representing the MIME type of the file. */
	mimeType?: MimeTypes;
	/** A number indicating the expiration period of the file, ranging from 1 to 365 days. */
	expiresIn?: number;
	/** Set to true if a security hash is required. */
	securityHash?: boolean;
	/** Set to true if the file should be set for automatic download. */
	autoDownload?: boolean;
};

export type CreateObjectResponse = {
	/** The id of the uploaded file. */
	id: string;
	/** The name of the uploaded file. */
	name: string;
	/** The size of the uploaded file. */
	size: number;
	/** The URL of the uploaded file. (File distributed in Square Cloud CDN) */
	url: string;
	/** The prefix of the uploaded file. */
	prefix?: string;
};
