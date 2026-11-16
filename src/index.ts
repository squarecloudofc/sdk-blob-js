/**
 * Official JavaScript SDK for Square Cloud Blob Storage.
 *
 * Create a client with your API key and call Blob Storage through its methods:
 *
 * ```js
 * import { SquareCloudBlob } from "@squarecloud/blob";
 *
 * const blob = new SquareCloudBlob(process.env.SQUARECLOUD_API_KEY);
 *
 * const { id, url } = await blob.put("./photo.png", { name: "photo", prefix: "avatars" });
 *
 * for await (const object of blob.list({ prefix: "avatars/" })) {
 *   console.log(object.id, object.size);
 * }
 * ```
 *
 * In a browser, upload with a short-lived upload token that your server mints
 * with {@link SquareCloudBlob.uploadTokens}, and never with the API key. When
 * Blob Storage refuses a call, the SDK throws a {@link SquareCloudBlobError}
 * with the HTTP status and the error code.
 *
 * @packageDocumentation
 */
import type { S3Client } from "@aws-sdk/client-s3";
import { SquareCloudBlobError } from "./error.ts";
import type {
	CopyDestination,
	CopyResult,
	DeleteManyResult,
	DownloadUrl,
	DownloadUrlOptions,
	FileInput,
	ListedObject,
	ListedShare,
	ListOptions,
	ListPage,
	ObjectChanges,
	ObjectInfo,
	PutOptions,
	PutResult,
	Rule,
	S3Credentials,
	SavedRule,
	Share,
	ShareOptions,
	Stats,
	UpdateResult,
	UploadToken,
	UploadTokenOptions,
} from "./types.ts";

const BASE_URL = "https://blob.squarecloud.app/v1/";

// Modules that only s3() and file paths load, so put() with a File or Blob needs
// neither. A const specifier keeps webpack, esbuild and Vite from resolving them
// at build time, and the .catch() on each import() makes Metro treat them as
// optional.
const S3_MODULE = "@aws-sdk/client-s3";
const FS_MODULE = "node:fs";

type RequestOptions = {
	query?: object;
	json?: object;
	body?: BodyInit;
	headers?: Record<string, string>;
};

// Above this size put() switches to a chunked upload. A single request is
// capped at 100 MiB, so this leaves room for the multipart envelope.
const CHUNKED_THRESHOLD = 90 * 1024 * 1024;
const PART_SIZE = 16 * 1024 * 1024;
// The service refuses a 7th part in flight with TOO_MANY_CONCURRENT_CHUNKS.
const PART_CONCURRENCY = 6;

/** Options for the {@link SquareCloudBlob} constructor. */
export type SquareCloudBlobOptions = {
	/**
	 * How many times a failed call is sent again before its error is thrown. The
	 * default is 2, and 0 turns retries off.
	 *
	 * @remarks
	 * Only calls that are safe to repeat are retried. Reads and the parts of a
	 * chunked upload are retried after a network error or a 5xx response. A part
	 * refused with 429 `TOO_MANY_CONCURRENT_CHUNKS` is also sent again. No other
	 * 429 is retried, and every other call gets one attempt. The wait before a
	 * retry doubles from 0.5 seconds up to 8 seconds, and random jitter shortens
	 * it by up to half.
	 */
	maxRetries?: number;
};

/**
 * Client for Square Cloud Blob Storage.
 *
 * Each object has an opaque `id`. Store it as returned, and never build or
 * parse it. Making an object public or private, or changing its expiration,
 * gives it a new id, so always replace a stored id with the one a call returns.
 * Use the `url` of a result instead of building URLs.
 *
 * @example
 * ```js
 * import { SquareCloudBlob } from "@squarecloud/blob";
 *
 * const blob = new SquareCloudBlob(process.env.SQUARECLOUD_API_KEY);
 * const { id } = await blob.put("./report.pdf", { name: "report", private: true });
 * const { url } = await blob.downloadUrl(id, { expires: 600 });
 * ```
 */
export class SquareCloudBlob {
	private readonly credential: string;
	private readonly maxRetries: number;
	private s3CredentialsCache?: Promise<S3Credentials>;

	/**
	 * Creates a client that authenticates every call with `credential`.
	 *
	 * @param credential - An API key from your Square Cloud account, or an upload
	 * token (`squp_...`) from {@link SquareCloudBlob.uploadTokens}. An upload token
	 * can only call {@link SquareCloudBlob.put}, and every other method throws 403
	 * `UPLOAD_TOKEN_NOT_ALLOWED`.
	 * @param options - Client options. See {@link SquareCloudBlobOptions}.
	 *
	 * @remarks
	 * Never send an API key to a browser. Mint an upload token on your server
	 * instead.
	 *
	 * @example
	 * ```js
	 * const blob = new SquareCloudBlob(process.env.SQUARECLOUD_API_KEY, { maxRetries: 2 });
	 * ```
	 */
	constructor(credential: string, options: SquareCloudBlobOptions = {}) {
		this.credential = credential;
		this.maxRetries = options.maxRetries ?? 2;
	}

	private async request<T>(
		method: string,
		path: string,
		{ query = {}, json, body, headers }: RequestOptions = {},
	): Promise<T> {
		const url = new URL(path, BASE_URL);
		for (const [key, value] of Object.entries(query)) {
			if (value === undefined || value === null) continue;
			// Booleans are sent as "true" or "false", because `false` is meaningful
			// for options such as private and overwrite.
			url.searchParams.set(
				key,
				typeof value === "object" ? JSON.stringify(value) : String(value),
			);
		}

		const init: RequestInit = {
			method,
			headers: { Authorization: this.credential, ...headers },
			body,
		};
		if (json) {
			init.body = JSON.stringify(json);
			init.headers = { ...init.headers, "Content-Type": "application/json" };
		}

		// Only what is safe to repeat: GET, and chunked parts (idempotent per part number)
		const idempotent =
			method === "GET" || (method === "PUT" && path === "objects/chunked");

		for (let attempt = 0; ; attempt++) {
			let response: Response | undefined;
			let text = "";
			try {
				response = await fetch(url, init);
				// Read here: a body cut off mid-read is a network error, not a bad body
				text = await response.text();
			} catch (networkError) {
				if (!idempotent || attempt >= this.maxRetries) throw networkError;
				response = undefined;
			}

			if (response) {
				const data = parseJson(text);
				if (response.ok && data?.status === "success") return data.response;

				const { status: _, code, message, ...extra } = data ?? {};
				const error = new SquareCloudBlobError(
					response.status,
					code ?? "UNKNOWN_ERROR",
					message ??
						(code
							? undefined
							: `Blob Storage answered HTTP ${response.status} without an error code, which usually means a proxy or gateway answered instead. Try again later, and check your network if it keeps happening.`),
					extra,
				);
				// A 429 is never retried, because RATE_LIMITED can be a 30-minute account
				// block. The exception is TOO_MANY_CONCURRENT_CHUNKS, a slot refusal sent
				// before the part is read. It happens, for example, when a part is resent
				// after a network error while the server still holds its slot.
				// ponytail: shares the maxRetries budget; a dedicated one if parallel large uploads matter
				const busy = code === "TOO_MANY_CONCURRENT_CHUNKS";
				if (
					!idempotent ||
					(response.status < 500 && !busy) ||
					attempt >= this.maxRetries
				) {
					throw error;
				}
			}

			// The service sends no Retry-After header, so the wait is an exponential
			// backoff with jitter, capped at 8 seconds.
			const delay = Math.min(8_000, 500 * 2 ** attempt);
			await new Promise((resolve) =>
				setTimeout(resolve, delay * (0.5 + Math.random() / 2)),
			);
		}
	}

	/**
	 * Uploads a file and returns the stored object.
	 *
	 * A file up to 90 MiB is sent in one request. A larger file, up to 10 GiB, is
	 * sent as a chunked upload in 16 MiB parts, 6 at a time. If the chunked upload
	 * fails, the SDK lets the parts in flight finish and then aborts it.
	 *
	 * @param file - A path to a file in Node.js, a `Blob` or `File`, or bytes. A
	 * path is streamed from disk and never read into memory.
	 * @param options - The name, prefix, visibility and other settings of the
	 * object. `name` is required unless the upload token fixes it. See
	 * {@link PutOptions}.
	 * @returns The stored object. Store its `id` as returned, and use its `url`,
	 * which is `null` for a private object.
	 *
	 * @throws {SquareCloudBlobError} 409 `OBJECT_ALREADY_EXISTS` when `overwrite`
	 * is `false` and the name is taken. Pass `overwrite: true` to replace the
	 * object, or choose another name.
	 * @throws {SquareCloudBlobError} 400 `FILE_TOO_SMALL` for a file under 512
	 * bytes, and 413 `FILE_TOO_LARGE` for a file above the limit of a rule or an
	 * upload token.
	 * @throws {SquareCloudBlobError} 403 `STORAGE_QUOTA_EXCEEDED` when the file
	 * does not fit your storage quota. Delete objects or upgrade your plan.
	 * @throws {SquareCloudBlobError} 401 `PERMISSION_DENIED` when the account has
	 * no active plan, and 403 `UPGRADE_REQUIRED` for an option your plan lacks,
	 * such as `metadata` below Pro.
	 * @throws {SquareCloudBlobError} 429 `RATE_LIMITED` past the upload rate
	 * limit, which is one upload a second below Pro. Wait for the window to pass
	 * before you try again.
	 * @throws {SquareCloudBlobError} 503 `STORAGE_UNAVAILABLE` while storage is
	 * briefly unreachable. Run the whole `put()` again after about 10 seconds.
	 * @throws {Error} When the path cannot be opened in Node.js, or for any path
	 * outside Node.js.
	 *
	 * @remarks
	 * With `overwrite: false`, a chunked upload checks the name with
	 * {@link SquareCloudBlob.info} before it sends any part. The check costs one
	 * request from your account's rate limit and needs the `blob:read` scope. If
	 * the check gets a 429, the SDK aborts the upload and throws that error. When
	 * the check cannot run, the service still refuses a taken name when the
	 * upload completes, and the SDK aborts the upload. With an upload token, `overwrite` has no effect,
	 * because the token decides whether its upload can replace an object.
	 *
	 * @example
	 * ```js
	 * const { id, url } = await blob.put("./photo.png", { name: "photo", prefix: "avatars" });
	 * ```
	 */
	async put(file: FileInput, options: PutOptions = {}): Promise<PutResult> {
		const data = await toBlob(file);
		const { filename: explicitName, mime_type, ...query } = options;
		const filename =
			explicitName ??
			(typeof file === "string"
				? file.split(/[\\/]/).pop()
				: (data as File).name) ??
			"blob";

		if (data.size <= CHUNKED_THRESHOLD) {
			const form = new FormData();
			const part = mime_type ? new Blob([data], { type: mime_type }) : data;
			form.append("file", part, filename);
			return this.request("POST", "objects", { query, body: form });
		}

		const { upload, id, chunk } = await this.request<{
			upload: string;
			id: string;
			chunk: { max_size: number; max_parts: number };
		}>("POST", "objects/chunked", {
			query: {
				...query,
				filename,
				mime_type: mime_type || data.type || undefined,
			},
		});
		// The upload handle is a credential: never log it
		const handle = { upload };
		const partSize = Math.min(
			chunk.max_size,
			Math.max(PART_SIZE, Math.ceil(data.size / chunk.max_parts)),
		);
		const parts = Math.ceil(data.size / partSize);
		let next = 0;
		let failure: { error: unknown } | undefined;

		const worker = async () => {
			while (!failure && next < parts) {
				const index = next++;
				await this.request("PUT", "objects/chunked", {
					query: { ...handle, part: index + 1 },
					// A Blob slice: re-sent whole when the part is retried
					body: data.slice(index * partSize, (index + 1) * partSize),
					headers: { "Content-Type": "application/octet-stream" },
				}).catch((error) => {
					failure ??= { error };
				});
			}
		};

		try {
			// The server enforces overwrite: false only when the upload completes, so the
			// name is checked first and a taken name fails before any part is sent. A 429
			// aborts, because the parts skip the rate limit but completing does not. Any
			// other info() failure, such as a 404 or a missing blob:read, skips the check.
			// There is no check where it cannot matter. An upload token's own settings
			// decide overwrite and the server ignores ours, and a hashed name (private or
			// security_hash) is never taken.
			if (
				query.overwrite === false &&
				!query.private &&
				!query.security_hash &&
				!this.credential.startsWith("squp_") &&
				(await this.info(id).then(
					() => true,
					(error) => {
						if (error?.status === 429) throw error;
						return false;
					},
				))
			) {
				throw new SquareCloudBlobError(
					409,
					"OBJECT_ALREADY_EXISTS",
					"An object with this name already exists, so the upload was aborted before any part was sent. Pass overwrite: true to replace it, or choose another name.",
				);
			}
			// Every worker settles before the abort, so no part lands after it
			await Promise.all(
				Array.from({ length: Math.min(PART_CONCURRENCY, parts) }, worker),
			);
			if (failure) throw failure.error;
			return await this.request("PATCH", "objects/chunked", { json: handle });
		} catch (error) {
			// Always abort, a 409 OBJECT_ALREADY_EXISTS at complete included: frees one of the 32 open-upload slots.
			// ponytail: the parts are lost; expose resume (status/open) when a caller needs to retry a multi-GB complete
			await this.request("DELETE", "objects/chunked", { json: handle }).catch(
				() => {},
			);
			throw error;
		}
	}

	/**
	 * Fetches one page of objects.
	 *
	 * Use it to list folders with `delimiter: "/"`, or to paginate by hand. Pass
	 * the page's `continuationToken` as `cursor` to fetch the next page. To walk
	 * every object, use {@link SquareCloudBlob.list}.
	 *
	 * @param options - Filters and the cursor. See {@link ListOptions}.
	 * @returns The objects on the page, the folders when `delimiter` is set, and
	 * the cursor of the next page, which is absent on the last page.
	 *
	 * @throws {SquareCloudBlobError} 400 `INVALID_CONTINUATION_TOKEN` when the
	 * cursor did not come from a previous page. Start again without a cursor.
	 * @throws {SquareCloudBlobError} 400 `PREFIX_REQUIRED` when the API key is
	 * restricted to several prefixes. Pass one of them as `prefix`.
	 * @throws {SquareCloudBlobError} 429 `RATE_LIMITED` past 30 pages every 30
	 * seconds.
	 */
	listPage(options: ListOptions = {}) {
		return this.request<ListPage>("GET", "objects", { query: options });
	}

	/**
	 * Iterates over every object, fetching pages as it goes.
	 *
	 * The order of objects is not guaranteed.
	 *
	 * @param options - Filters. See {@link ListOptions}.
	 * @returns An async iterator over the objects.
	 *
	 * @throws {SquareCloudBlobError} The errors of {@link SquareCloudBlob.listPage},
	 * while iterating.
	 *
	 * @remarks
	 * Each page is one request, and listing allows 30 requests every 30 seconds.
	 * A large account can reach that limit, so pass a `prefix` when you can.
	 *
	 * @example
	 * ```js
	 * for await (const object of blob.list({ prefix: "avatars/" })) {
	 *   console.log(object.id, object.size);
	 * }
	 * ```
	 */
	async *list(
		options: Omit<ListOptions, "cursor"> = {},
	): AsyncGenerator<ListedObject> {
		let cursor: string | undefined;
		do {
			const page = await this.listPage({ ...options, cursor });
			yield* page.objects;
			cursor = page.continuationToken;
		} while (cursor);
	}

	/**
	 * Returns the details of one object, such as its size, Content-Type, headers,
	 * metadata and expiration.
	 *
	 * @param id - The object id.
	 * @returns The details of the object.
	 *
	 * @throws {SquareCloudBlobError} 404 `OBJECT_NOT_FOUND` when the object does
	 * not exist, and 400 `INVALID_OBJECT` when the id is not one of your objects.
	 * @throws {SquareCloudBlobError} 429 `RATE_LIMITED` past 60 calls a minute.
	 */
	info(id: string) {
		return this.request<ObjectInfo>("GET", "objects/info", {
			query: { object: id },
		});
	}

	/**
	 * Returns a link to download an object.
	 *
	 * A public object returns its permanent URL on the global edge CDN. A private
	 * object, or any call with `disposition` or `filename`, returns a temporary
	 * link that lives `expires` seconds, at most 24 hours.
	 *
	 * @param id - The object id.
	 * @param options - The lifetime of a temporary link, and how browsers handle
	 * the file. See {@link DownloadUrlOptions}.
	 * @returns The link. Its `expires_at` is set for a temporary link and `null`
	 * for a permanent one.
	 *
	 * @throws {SquareCloudBlobError} 401 `PERMISSION_DENIED` when a temporary link
	 * is needed and the account has no active plan.
	 * @throws {SquareCloudBlobError} 404 `OBJECT_NOT_FOUND` when the object does
	 * not exist.
	 * @throws {SquareCloudBlobError} 429 `RATE_LIMITED` past 60 calls a minute.
	 *
	 * @remarks
	 * A temporary link cannot be revoked on its own. It stops working early when
	 * the API key that created it is revoked, regenerated or expires, when the
	 * session that created it logs out, and when the object is overwritten,
	 * moved, deleted, or made public or private. For links that you can revoke
	 * one by one, protect with a password or cap by downloads, use
	 * {@link SquareCloudBlob.shares}.
	 */
	downloadUrl(id: string, options: DownloadUrlOptions = {}) {
		return this.request<DownloadUrl>("GET", "objects/download", {
			query: { object: id, ...options, redirect: false },
		});
	}

	/**
	 * Changes the visibility, expiration, cache, disposition or metadata of one
	 * object or of up to 50.
	 *
	 * Making an object public or private, or changing its expiration, gives it a
	 * new id. Replace your stored id with the `id` of its result.
	 *
	 * @param ids - One object id, or an array of up to 50.
	 * @param changes - What to change. A `null` value removes a setting. See
	 * {@link ObjectChanges}.
	 * @returns One result per object, always as an array. Each result reports its
	 * own success in `ok`, so check it before you read `id`.
	 *
	 * @throws {SquareCloudBlobError} 400 `TOO_MANY_OBJECTS` for more than 50 ids,
	 * and 400 `NOTHING_TO_UPDATE` when `changes` is empty.
	 * @throws {SquareCloudBlobError} 403 `UPGRADE_REQUIRED` when your plan lacks a
	 * requested setting, such as `metadata` below Pro or an expiration under 7
	 * days below Enterprise.
	 *
	 * @remarks
	 * A failure on one object does not throw. Its result has `ok: false` and a
	 * `code`. Without an active plan, only making objects private works, and any
	 * other change reports `PERMISSION_DENIED`. Making a private object public
	 * also needs the `blob:read` scope.
	 *
	 * @example
	 * ```js
	 * const [result] = await blob.update(id, { private: true });
	 * if (result.ok) id = result.id;
	 * ```
	 */
	async update(ids: string | string[], changes: ObjectChanges) {
		const target = typeof ids === "string" ? { object: ids } : { objects: ids };
		const { results } = await this.request<{ results: UpdateResult[] }>(
			"PATCH",
			"objects",
			{ json: { ...target, ...changes } },
		);
		return results;
	}

	/**
	 * Deletes one object immediately and permanently. There is no trash.
	 *
	 * @param id - The object id.
	 *
	 * @throws {SquareCloudBlobError} 404 `OBJECT_NOT_FOUND` when the object does
	 * not exist.
	 * @throws {SquareCloudBlobError} 403 `PREFIX_NOT_ALLOWED` when the API key is
	 * restricted to other prefixes.
	 * @throws {SquareCloudBlobError} 500 `DELETE_FAILED` when storage failed and
	 * the object may still exist. Try again.
	 */
	delete(id: string): Promise<void>;
	/**
	 * Deletes up to 100 objects immediately and permanently. There is no trash.
	 *
	 * @param ids - Up to 100 object ids.
	 * @returns The ids that were deleted, the ids that did not exist, and the ids
	 * that failed, each with its code. A missing object or a failure on one
	 * object does not throw.
	 *
	 * @throws {SquareCloudBlobError} 400 `TOO_MANY_OBJECTS` for more than 100 ids.
	 */
	delete(ids: string[]): Promise<DeleteManyResult>;
	async delete(ids: string | string[]): Promise<unknown> {
		if (typeof ids === "string") {
			await this.request("DELETE", "objects", { json: { object: ids } });
			return;
		}
		if (ids.length !== 1) {
			return this.request<DeleteManyResult>("DELETE", "objects", {
				json: { objects: ids },
			});
		}

		// The API answers a one-id batch like a single delete
		const result: DeleteManyResult = { deleted: [], not_found: [], failed: [] };
		try {
			await this.delete(ids[0]);
			result.deleted.push(ids[0]);
		} catch (error) {
			if (!(error instanceof SquareCloudBlobError)) throw error;
			if (error.code === "OBJECT_NOT_FOUND") result.not_found.push(ids[0]);
			else if (
				error.code === "DELETE_FAILED" ||
				error.code === "PREFIX_NOT_ALLOWED"
			)
				result.failed.push({ id: ids[0], code: error.code });
			else throw error;
		}
		return result;
	}

	/**
	 * Copies an object inside Blob Storage, without downloading it.
	 *
	 * The copy counts toward your storage quota and keeps the extension of the
	 * source. It lands at the root unless `destination.prefix` says otherwise.
	 *
	 * @param source - The id of the object to copy.
	 * @param destination - The name, prefix, visibility and expiration of the
	 * copy. See {@link CopyDestination}.
	 * @param options - Pass `overwrite: true` to replace an existing object at the
	 * destination, or `move: true` to move the object, as
	 * {@link SquareCloudBlob.move} does.
	 * @returns The new object, the id of the source, and whether an existing
	 * object was replaced.
	 *
	 * @throws {SquareCloudBlobError} 409 `OBJECT_ALREADY_EXISTS` when the
	 * destination is taken. Pass `overwrite: true` to replace it.
	 * @throws {SquareCloudBlobError} 404 `OBJECT_NOT_FOUND` when the source does
	 * not exist, and 400 `SAME_OBJECT` when the destination is the source.
	 * @throws {SquareCloudBlobError} 403 `MISSING_SCOPE` when the API key lacks
	 * `blob:read`, which a copy needs on top of `blob:write`. 403
	 * `PREFIX_NOT_ALLOWED` when the source or the destination is outside the
	 * prefixes of the API key.
	 * @throws {SquareCloudBlobError} 403 `STORAGE_QUOTA_EXCEEDED` when the copy
	 * does not fit your storage quota, and 401 `PERMISSION_DENIED` when the
	 * account has no active plan.
	 *
	 * @remarks
	 * The rules of the destination prefix apply as they do to an upload, so a
	 * disallowed extension fails with 400 `FILE_TYPE_NOT_ALLOWED` and a file above
	 * its `max_size` with 413 `FILE_TOO_LARGE`.
	 */
	copy(
		source: string,
		destination: CopyDestination,
		options: { overwrite?: boolean; move?: boolean } = {},
	) {
		return this.request<CopyResult>("POST", "objects/copy", {
			json: { source, destination, ...options },
		});
	}

	/**
	 * Moves or renames an object.
	 *
	 * Unlike a copy, a move does not count toward your storage quota, because the
	 * source is removed. The object lands at the root unless `destination.prefix`
	 * says otherwise.
	 *
	 * @param source - The id of the object to move.
	 * @param destination - The new name, prefix, visibility and expiration. See
	 * {@link CopyDestination}.
	 * @param options - Pass `overwrite: true` to replace an existing object at the
	 * destination.
	 * @returns The moved object. Replace your stored id with its `id`.
	 *
	 * @throws {SquareCloudBlobError} The errors of {@link SquareCloudBlob.copy},
	 * except `STORAGE_QUOTA_EXCEEDED`.
	 */
	move(
		source: string,
		destination: CopyDestination,
		options: { overwrite?: boolean } = {},
	) {
		return this.copy(source, destination, { ...options, move: true });
	}

	/**
	 * Returns the storage usage of the account, the storage your plan includes,
	 * and an estimate of the cost of usage above it.
	 *
	 * @returns The object count and bytes stored, the bytes your plan includes,
	 * this month's daily average and a cost estimate. The estimate is not
	 * charged.
	 *
	 * @throws {SquareCloudBlobError} 403 `PREFIX_NOT_ALLOWED` when the API key is
	 * restricted to prefixes. Account stats need a key for the whole account.
	 * @throws {SquareCloudBlobError} 429 `RATE_LIMITED` past 20 calls a minute.
	 *
	 * @remarks
	 * The service caches the answer for up to 60 seconds.
	 */
	stats() {
		return this.request<Stats>("GET", "account/stats");
	}

	/**
	 * Per-prefix rules. A rule sets the default visibility, expiration and
	 * Cache-Control of new objects under its prefix, limits their size and
	 * extensions, and can delete them after a number of days.
	 */
	readonly rules = {
		/**
		 * Returns the saved rules.
		 *
		 * @returns Every rule, with when it was saved and, for a rule that deletes
		 * objects, when deletion starts.
		 */
		get: async () =>
			(await this.request<{ rules: SavedRule[] }>("GET", "account/settings"))
				.rules,
		/**
		 * Replaces every rule with `rules` and returns the saved list.
		 *
		 * @param rules - The full list of rules. A rule left out is deleted, so an
		 * empty array removes them all. See {@link Rule}.
		 * @returns The saved rules.
		 *
		 * @throws {SquareCloudBlobError} 400 `INVALID_RULE_<FIELD>` or
		 * `DUPLICATE_RULE_PREFIX` for an invalid rule. The prefix of the rule is in
		 * `extra.prefix`.
		 * @throws {SquareCloudBlobError} 403 `UPGRADE_REQUIRED` past the number of
		 * rules your plan allows, or for a setting it lacks.
		 * @throws {SquareCloudBlobError} 403 `PREFIX_NOT_ALLOWED` when the API key is
		 * restricted to prefixes. Rules need a key for the whole account.
		 *
		 * @remarks
		 * Plans allow up to 5 rules, Pro allows 10 and Enterprise allows 20. A rule
		 * with `delete_after_days` starts deleting 24 hours after it is saved, and
		 * saving it again unchanged keeps that date.
		 */
		set: async (rules: Rule[]) =>
			(
				await this.request<{ rules: SavedRule[] }>("PUT", "account/settings", {
					json: { rules },
				})
			).rules,
	};

	/** Upload tokens, which let a browser upload without your API key. */
	readonly uploadTokens = {
		/**
		 * Mints a short-lived upload token on your server for a browser to upload
		 * with, so the API key never leaves the server.
		 *
		 * The token can only call {@link SquareCloudBlob.put}. Every option it is
		 * minted with is fixed, and the browser cannot change it.
		 *
		 * @param options - What the token fixes, and how long and how many times it
		 * can be used. See {@link UploadTokenOptions}.
		 * @returns The token, when it expires and how many uploads it allows.
		 *
		 * @throws {SquareCloudBlobError} 403 `PREFIX_NOT_ALLOWED` when an API key
		 * restricted to prefixes asks for a prefix outside them, and 403
		 * `UPGRADE_REQUIRED` for an option your plan lacks.
		 * @throws {SquareCloudBlobError} 400 `UPLOAD_TOKEN_TOO_LARGE` when the token
		 * would carry too many settings. Metadata is the usual cause.
		 * @throws {SquareCloudBlobError} 401 `PERMISSION_DENIED` when the account has
		 * no active plan.
		 *
		 * @remarks
		 * Revoking or regenerating the API key that minted a token stops the token,
		 * and so does logging out the session that minted it.
		 *
		 * @example
		 * ```js
		 * // Server
		 * const { token } = await blob.uploadTokens.create({ prefix: "avatars/", max_size: 5 * 1024 * 1024 });
		 *
		 * // Browser
		 * await new SquareCloudBlob(token).put(input.files[0], { name: "avatar" });
		 * ```
		 */
		create: (options: UploadTokenOptions = {}) =>
			this.request<UploadToken>("POST", "upload-tokens", { json: options }),
	};

	/**
	 * Share links. A share is a link to one object that you can revoke, with an
	 * expiration, an optional password and an optional download cap.
	 */
	readonly shares = {
		/**
		 * Creates a share link to an object.
		 *
		 * @param object - The id of the object to share.
		 * @param options - How long the link lives, how many downloads it allows
		 * and its password. See {@link ShareOptions}.
		 * @returns The share. Check `object_is_public` before you rely on its
		 * protections.
		 *
		 * @throws {SquareCloudBlobError} 404 `OBJECT_NOT_FOUND` when the object does
		 * not exist.
		 * @throws {SquareCloudBlobError} 403 `UPGRADE_REQUIRED` for a password below
		 * Pro, and 401 `PERMISSION_DENIED` when the account has no active plan.
		 * @throws {SquareCloudBlobError} 409 `TOO_MANY_SHARES` past 1000 active
		 * links. Revoke some first.
		 *
		 * @remarks
		 * When `object_is_public` is `true`, the link redirects to the object's
		 * public URL, so the password, download cap and expiration do not protect
		 * the file. Make the object private with {@link SquareCloudBlob.update}
		 * before you share it. A link stops working when the object is moved,
		 * deleted, overwritten, or made public or private.
		 */
		create: (object: string, options: ShareOptions = {}) =>
			this.request<Share>("POST", "shares", { json: { object, ...options } }),
		/**
		 * Returns the active share links.
		 *
		 * @returns Every active share. An API key restricted to prefixes sees only
		 * the shares of objects inside them.
		 */
		list: async () =>
			(await this.request<{ shares: ListedShare[] }>("GET", "shares")).shares,
		/**
		 * Revokes a share link at once.
		 *
		 * @param id - The share id, from {@link Share} or {@link ListedShare}.
		 *
		 * @throws {SquareCloudBlobError} 404 `SHARE_NOT_FOUND` when no active share
		 * has this id.
		 */
		revoke: async (id: string) => {
			await this.request("DELETE", "shares", { json: { id } });
		},
	};

	/**
	 * Returns the S3 key pair of this API key, for use with any S3 client.
	 *
	 * The pair is the same on every call, so the client fetches it once and
	 * reuses it. It stops working when the API key is revoked, regenerated or
	 * expires.
	 *
	 * @returns The key pair, the endpoint, region and buckets to configure, and
	 * what the pair can read and write.
	 *
	 * @throws {SquareCloudBlobError} 403 `UPLOAD_TOKEN_NOT_ALLOWED` when the client
	 * uses an upload token. S3 needs an API key.
	 * @throws {SquareCloudBlobError} 429 `RATE_LIMITED` past 10 calls an hour.
	 *
	 * @remarks
	 * A failed call is not cached, so the next call tries again.
	 */
	s3Credentials() {
		this.s3CredentialsCache ??= this.request<S3Credentials>(
			"GET",
			"s3/credentials",
		).catch((error) => {
			this.s3CredentialsCache = undefined;
			throw error;
		});
		return this.s3CredentialsCache;
	}

	/**
	 * Returns an `S3Client` set up for the Blob Storage S3 gateway, which has two
	 * buckets, `public` and `private`.
	 *
	 * It needs the optional `@aws-sdk/client-s3` package and an API key, so use
	 * it on a server such as Node.js, never in a browser.
	 *
	 * @returns A ready `S3Client` from `@aws-sdk/client-s3`.
	 *
	 * @throws {Error} When `@aws-sdk/client-s3` cannot be loaded. Install it, or
	 * pass {@link SquareCloudBlob.s3Credentials} to another S3 client.
	 * @throws {SquareCloudBlobError} The errors of
	 * {@link SquareCloudBlob.s3Credentials}.
	 *
	 * @example
	 * ```js
	 * import { ListObjectsV2Command } from "@aws-sdk/client-s3";
	 *
	 * const s3 = await blob.s3();
	 * await s3.send(new ListObjectsV2Command({ Bucket: "public" }));
	 * ```
	 */
	async s3(): Promise<S3Client> {
		const [{ S3Client }, credentials] = await Promise.all([
			import(/* webpackIgnore: true */ /* @vite-ignore */ S3_MODULE).catch(
				(cause) => {
					throw new Error(
						"s3() needs the optional @aws-sdk/client-s3 package, which could not be loaded. Install it with npm install @aws-sdk/client-s3, or pass s3Credentials() to another S3 client.",
						{ cause },
					);
				},
			) as Promise<typeof import("@aws-sdk/client-s3")>,
			this.s3Credentials(),
		]);
		return new S3Client({
			endpoint: credentials.endpoint,
			region: credentials.region,
			forcePathStyle: true,
			credentials: {
				accessKeyId: credentials.access_key_id,
				secretAccessKey: credentials.secret_access_key,
			},
		});
	}
}

function parseJson(text: string) {
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

async function toBlob(file: FileInput): Promise<Blob> {
	if (typeof file === "string") {
		// Only file paths load node:fs, and the Blob it returns streams from disk.
		const { openAsBlob }: typeof import("node:fs") = await import(
			/* webpackIgnore: true */ /* @vite-ignore */ FS_MODULE
		).catch((cause) => {
			throw new Error(
				"File paths can only be uploaded in Node.js. Pass a Blob, a File or bytes instead.",
				{ cause },
			);
		});
		try {
			return (await openAsBlob(file)) as Blob;
		} catch (cause) {
			throw new Error(
				`Cannot open the file "${file}". Check that the path exists and that this process can read it.`,
				{ cause },
			);
		}
	}
	return file instanceof Blob ? file : new Blob([file as BlobPart]);
}

export * from "./error.ts";
export * from "./types.ts";
