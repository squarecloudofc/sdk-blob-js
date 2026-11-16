/**
 * Error codes that Blob Storage returns, plus `UNKNOWN_ERROR`, which the SDK sets
 * when a response carries no code.
 *
 * @remarks
 * Validation errors are 400 with a code of the form `INVALID_<FIELD>`, such as
 * `INVALID_OBJECT_NAME`. The union also accepts any other string, so a code the
 * service adds later still type-checks.
 */
export type BlobErrorCode =
	// Credentials, scopes, plans and availability
	| "ACCESS_DENIED"
	/** @deprecated The service no longer sends it. An account or IP block is now `RATE_LIMITED`. */
	| "RATE_LIMIT"
	/**
	 * 429 when a call goes over a rate limit. It is used both for the limit of one
	 * operation and for the account-wide block, which can last about 30 minutes.
	 * The SDK never retries it.
	 */
	| "RATE_LIMITED"
	| "MISSING_SCOPE"
	| "RESOURCE_NOT_ALLOWED"
	| "UPLOAD_TOKEN_NOT_ALLOWED"
	| "UPLOAD_TOKEN_USED"
	| "PREFIX_NOT_ALLOWED"
	| "PERMISSION_DENIED"
	| "ACCOUNT_BLOCKED"
	/**
	 * 403 when your plan does not include what the call asked for. The message
	 * names the limit or feature and the plan that includes it.
	 */
	| "UPGRADE_REQUIRED"
	| "STORAGE_QUOTA_EXCEEDED"
	| "PRIVATE_STORAGE_UNAVAILABLE"
	| "PUBLIC_STORAGE_UNAVAILABLE"
	| "TOO_MANY_CONCURRENT_UPLOADS"
	| "UPLOAD_FAILED"
	/**
	 * 503 while storage is briefly unreachable. The service refuses object calls
	 * in windows of about 10 seconds. The SDK retries reads and chunked upload
	 * parts within `maxRetries`, which may not outlast the window, so try again
	 * after about 10 seconds.
	 */
	| "STORAGE_UNAVAILABLE"
	| "INTERNAL_SERVER_ERROR"
	| "NOT_FOUND"
	// Objects
	| "OBJECT_NOT_FOUND"
	| "OBJECT_ALREADY_EXISTS"
	/** @deprecated The service no longer sends it. Headers now change in place on every object. */
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
	/**
	 * 429 when more than 6 parts are in flight for the account. The SDK sends the
	 * part again within `maxRetries`.
	 */
	| "TOO_MANY_CONCURRENT_CHUNKS"
	| "TOO_MANY_OPEN_UPLOADS"
	| "INVALID_UPLOAD_TOKEN"
	| "UPLOAD_NOT_FOUND"
	| "NO_CHUNKS_UPLOADED"
	| "EMPTY_CHUNK"
	| "INVALID_CHUNK_PART"
	| "CHUNK_TOO_SMALL"
	| "CHUNK_TOO_LARGE"
	// Rules, upload tokens, shares and S3
	| "TOO_MANY_RULES"
	| "DUPLICATE_RULE_PREFIX"
	| "INVALID_RULES"
	| "UPLOAD_TOKEN_TOO_LARGE"
	| "TOO_MANY_SHARES"
	| "SHARE_NOT_FOUND"
	| "INVALID_SHARE"
	| "API_KEY_REQUIRED"
	/** @deprecated The service no longer sends it. An old API key is refused with 401 `ACCESS_DENIED`, like any unknown key. */
	| "LEGACY_API_KEY"
	// Validation errors (400), such as INVALID_OBJECT, INVALID_OBJECT_NAME and INVALID_RULE_PREFIX
	| `INVALID_${string}`
	/**
	 * Set by the SDK when a response carries no error code, such as an error page
	 * from a proxy. `status` still holds the real HTTP status.
	 */
	| "UNKNOWN_ERROR"
	| (string & {});

/**
 * Error thrown when Blob Storage refuses a call.
 *
 * Match on {@link SquareCloudBlobError.code} rather than on the message, which
 * can change.
 *
 * @remarks
 * A call that gets no complete response, such as a DNS failure, a reset
 * connection or a body cut off mid-read, throws the `fetch` error itself. A
 * batch `update()` or `delete()` reports per-object failures in its result
 * instead of throwing.
 *
 * @example
 * ```js
 * import { SquareCloudBlobError } from "@squarecloud/blob";
 *
 * try {
 *   await blob.delete(id);
 * } catch (error) {
 *   if (error instanceof SquareCloudBlobError && error.code === "OBJECT_NOT_FOUND") {
 *     console.log("The object was already gone.");
 *   } else {
 *     throw error;
 *   }
 * }
 * ```
 */
export class SquareCloudBlobError extends Error {
	/** Always `"SquareCloudBlobError"`. */
	name = "SquareCloudBlobError";
	/** The HTTP status of the response, such as 404. */
	readonly status: number;
	/** The error code, such as `OBJECT_NOT_FOUND`. */
	readonly code: BlobErrorCode;
	/**
	 * Other fields of the error body, such as `prefix` on a rule error. It is an
	 * empty object when there are none.
	 */
	readonly extra: Record<string, unknown>;

	/**
	 * Creates an error. The SDK creates these for you, so you rarely need this
	 * constructor outside tests.
	 *
	 * @param status - The HTTP status.
	 * @param code - The error code.
	 * @param message - The explanation. It defaults to `code`.
	 * @param extra - Other fields of the error body.
	 */
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

	/**
	 * Returns `true` when your plan does not include what the call asked for.
	 *
	 * @remarks
	 * Every plan refusal uses the code `UPGRADE_REQUIRED`, and the message names
	 * the limit or feature. An account without any active plan gets 401
	 * `PERMISSION_DENIED` instead, for which this returns `false`.
	 */
	isUpgradeRequired() {
		return this.code === "UPGRADE_REQUIRED";
	}
}
