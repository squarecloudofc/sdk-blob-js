/** Error codes emitted by the Square Cloud Blob API, plus SDK-side validation codes. */
export type BlobErrorCode =
	// Global (any route)
	| "ACCESS_DENIED"
	| "RATE_LIMIT"
	| "ROUTE_NOT_FOUND"
	| "NOT_FOUND"
	| "INTERNAL_SERVER_ERROR"
	// Upload
	| "PERMISSION_DENIED"
	| "RATE_LIMITED"
	| "TOO_MANY_CONCURRENT_UPLOADS"
	| "STORAGE_QUOTA_EXCEEDED"
	| "INVALID_CONTENT_TYPE"
	| "INVALID_FILE"
	| "INVALID_FILE_TYPE"
	| "FILE_TOO_SMALL"
	| "FILE_TOO_LARGE"
	| "INVALID_OBJECT_NAME"
	| "INVALID_OBJECT_PREFIX"
	| "INVALID_OBJECT_EXPIRE"
	| "INVALID_OBJECT_SECURITY_HASH"
	| "INVALID_STORAGE_AUTO_DOWNLOAD"
	| "UPLOAD_FAILED"
	// List
	| "INVALID_CONTINUATION_TOKEN"
	| "LIST_FAILED"
	// Delete
	| "INVALID_BODY"
	| "INVALID_OBJECT"
	| "OBJECT_NOT_FOUND"
	| "DELETE_FAILED"
	// SDK-side only
	| "MIME_TYPE_REQUIRED"
	| "INVALID_FILE_PATH"
	| "INVALID_OBJECT_URL"
	| (string & {});

export class SquareCloudBlobError extends Error {
	constructor(
		/** The raw error code, as emitted by the API or the SDK validation. */
		public readonly code: BlobErrorCode,
		message?: string,
		cause?: unknown,
	) {
		const title = code
			.replaceAll("_", " ")
			.toLowerCase()
			.replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());

		super(message ? `${title}: ${message}` : title, { cause });
		this.name = SquareCloudBlobError.name;
	}
}

export class SquareCloudValidationError extends SquareCloudBlobError {
	constructor(...args: ConstructorParameters<typeof SquareCloudBlobError>) {
		super(...args);
		this.name = SquareCloudValidationError.name;
	}
}
