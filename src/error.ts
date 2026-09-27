/** Error codes emitted by the Square Cloud Blob API. */
export type BlobErrorCode =
	// Global
	| "ACCESS_DENIED"
	| "RATE_LIMIT"
	| "RATE_LIMITED"
	| "MISSING_SCOPE"
	| "RESOURCE_NOT_ALLOWED"
	| "UPLOAD_TOKEN_NOT_ALLOWED"
	| "UPLOAD_TOKEN_USED"
	| "PREFIX_NOT_ALLOWED"
	| "PERMISSION_DENIED"
	| "ACCOUNT_BLOCKED"
	| "UPGRADE_REQUIRED"
	| "STORAGE_QUOTA_EXCEEDED"
	| "PRIVATE_STORAGE_UNAVAILABLE"
	| "PUBLIC_STORAGE_UNAVAILABLE"
	| "TOO_MANY_CONCURRENT_UPLOADS"
	| "UPLOAD_FAILED"
	| "INTERNAL_SERVER_ERROR"
	| "NOT_FOUND"
	// Objects
	| "OBJECT_NOT_FOUND"
	| "OBJECT_ALREADY_EXISTS"
	| "OBJECT_IS_LEGACY"
	| "CHECKSUM_MISMATCH"
	| "INVALID_CONTENT_TYPE"
	| "FILE_TOO_LARGE"
	| "FILE_TOO_SMALL"
	| "BLOCKED_FILE_TYPE"
	| "INVALID_FILE_TYPE"
	| "FILE_TYPE_NOT_ALLOWED"
	| "NOTHING_TO_UPDATE"
	| "VISIBILITY_CHANGE_FAILED"
	| "UPDATE_FAILED"
	| "DELETE_FAILED"
	| "TOO_MANY_OBJECTS"
	| "SAME_OBJECT"
	| "INVALID_DESTINATION"
	| "COPY_FAILED"
	| "PREFIX_REQUIRED"
	| "INVALID_CONTINUATION_TOKEN"
	// Chunked uploads
	| "TOO_MANY_CONCURRENT_CHUNKS"
	| "TOO_MANY_OPEN_UPLOADS"
	| "INVALID_UPLOAD_TOKEN"
	| "UPLOAD_NOT_FOUND"
	| "NO_CHUNKS_UPLOADED"
	| "EMPTY_CHUNK"
	| "INVALID_CHUNK_PART"
	| "CHUNK_TOO_SMALL"
	| "CHUNK_TOO_LARGE"
	// Settings, tokens, shares, S3
	| "TOO_MANY_RULES"
	| "INVALID_RULES"
	| "UPLOAD_TOKEN_TOO_LARGE"
	| "TOO_MANY_SHARES"
	| "SHARE_NOT_FOUND"
	| "INVALID_SHARE"
	| "API_KEY_REQUIRED"
	| "LEGACY_API_KEY"
	// Validation (400): INVALID_OBJECT, INVALID_OBJECT_NAME, INVALID_RULE_PREFIX, ...
	| `INVALID_${string}`
	// SDK: a non-JSON response (e.g. a proxy error page)
	| "UNKNOWN_ERROR"
	| (string & {});

export class SquareCloudBlobError extends Error {
	name = "SquareCloudBlobError";
	/** HTTP status of the response. */
	readonly status: number;
	/** The API error code, e.g. `OBJECT_NOT_FOUND`. */
	readonly code: BlobErrorCode;
	/** Extra fields of the error body, e.g. `prefix` on rule errors. */
	readonly extra: Record<string, unknown>;

	constructor(
		status: number,
		code: BlobErrorCode,
		message?: string,
		extra: Record<string, unknown> = {},
	) {
		super(message ?? code);
		this.status = status;
		this.code = code;
		this.extra = extra;
	}

	/** Every plan refusal (limit, feature or plan) uses this code; the message says which. */
	isUpgradeRequired() {
		return this.code === "UPGRADE_REQUIRED";
	}
}
