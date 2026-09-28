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

type RequestOptions = {
	query?: object;
	json?: object;
	body?: BodyInit;
	headers?: Record<string, string>;
};

/** Above this size `put()` switches to a chunked upload (simple uploads stop at 100 MB). */
const CHUNKED_THRESHOLD = 90 * 1024 * 1024;
const PART_SIZE = 16 * 1024 * 1024;
/** A 7th concurrent part fails with TOO_MANY_CONCURRENT_CHUNKS. */
const PART_CONCURRENCY = 6;

export type SquareCloudBlobOptions = {
	/**
	 * Retries network errors and 5xx on GET and chunked parts only; never a 429
	 * except TOO_MANY_CONCURRENT_CHUNKS on a part (default 2).
	 */
	maxRetries?: number;
};

export class SquareCloudBlob {
	private readonly credential: string;
	private readonly maxRetries: number;
	private s3CredentialsCache?: Promise<S3Credentials>;

	/**
	 * @param credential - An API key (`userID-secret`), or an upload token
	 * (`squp_...`) that can only call `put()`.
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
			// Booleans go as "true"/"false"; `false` is meaningful (private, overwrite...)
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
					message,
					extra,
				);
				// Never a 429 (RATE_LIMITED can be a 30-minute account block), except
				// TOO_MANY_CONCURRENT_CHUNKS: a slot refusal before the part is read, e.g. a part
				// resent after a network error while the server still holds its slot.
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

			// No Retry-After header exists: exponential backoff with jitter, capped at 8s
			const delay = Math.min(8_000, 500 * 2 ** attempt);
			await new Promise((resolve) =>
				setTimeout(resolve, delay * (0.5 + Math.random() / 2)),
			);
		}
	}

	/**
	 * Uploads a file. Files above ~90 MB go through a chunked upload (up to
	 * 10 GiB, 6 parts in parallel); a failed chunked upload is aborted.
	 *
	 * The returned `id` is opaque: store it as-is. Use `url` from the result
	 * (`null` for private objects) instead of building URLs.
	 *
	 * @example
	 * ```js
	 * const { id, url } = await blob.put("photo.png", { name: "photo", prefix: "avatars" });
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

		const { upload, chunk } = await this.request<{
			upload: string;
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
			// Every worker settles before the abort, so no part lands after it
			await Promise.all(
				Array.from({ length: Math.min(PART_CONCURRENCY, parts) }, worker),
			);
			if (failure) throw failure.error;
			return await this.request("PATCH", "objects/chunked", { json: handle });
		} catch (error) {
			// ponytail: always abort (frees one of the 32 open-upload slots); expose resume (status/open) when a caller needs to retry a multi-GB complete
			await this.request("DELETE", "objects/chunked", { json: handle }).catch(
				() => {},
			);
			throw error;
		}
	}

	/** Fetches one page of objects. Use this for `folders` or manual pagination. */
	listPage(options: ListOptions = {}) {
		return this.request<ListPage>("GET", "objects", { query: options });
	}

	/**
	 * Iterates over every object, following the cursor. Order is not guaranteed.
	 *
	 * @example
	 * ```js
	 * for await (const object of blob.list({ prefix: "avatars/" })) console.log(object.id);
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

	/** Details of one object: size, type, headers, metadata, expiration. */
	info(id: string) {
		return this.request<ObjectInfo>("GET", "objects/info", {
			query: { object: id },
		});
	}

	/**
	 * A download link. Public objects get their permanent CDN URL; private ones,
	 * or any call with `disposition`/`filename`, get a temporary link (max 24 h)
	 * that cannot be revoked. For revocable, password or download-capped links,
	 * use `shares.create()`.
	 */
	downloadUrl(id: string, options: DownloadUrlOptions = {}) {
		return this.request<DownloadUrl>("GET", "objects/download", {
			query: { object: id, ...options, redirect: false },
		});
	}

	/**
	 * Changes visibility, expiration, cache, disposition or metadata of up to 50
	 * objects. Changing visibility or expiration CHANGES THE ID: replace your
	 * stored id with `result.id`. Each result reports its own success.
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
	 * Deletes immediately and permanently (there is no trash). A single id
	 * throws `OBJECT_NOT_FOUND` when missing; an array (up to 100) reports
	 * each id instead.
	 */
	delete(id: string): Promise<void>;
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
	 * Copies an object server-side (counts toward the quota). `destination.name`
	 * has no extension: the copy keeps the source's.
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

	/** Moves or renames an object (does not count toward the quota). */
	move(
		source: string,
		destination: CopyDestination,
		options: { overwrite?: boolean } = {},
	) {
		return this.copy(source, destination, { ...options, move: true });
	}

	/** Account usage. `billing` is an estimate only: the excess is never charged. */
	stats() {
		return this.request<Stats>("GET", "account/stats");
	}

	/** Per-prefix rules (visibility, expiration, size, extensions, lifecycle). */
	readonly rules = {
		get: async () =>
			(await this.request<{ rules: SavedRule[] }>("GET", "account/settings"))
				.rules,
		/** Replaces the WHOLE list. Lifecycle deletion starts 24 h after saving. */
		set: async (rules: Rule[]) =>
			(
				await this.request<{ rules: SavedRule[] }>("PUT", "account/settings", {
					json: { rules },
				})
			).rules,
	};

	readonly uploadTokens = {
		/**
		 * Mints a short-lived token on your server for a browser to upload with,
		 * so the API key never leaves the server.
		 *
		 * @example
		 * ```js
		 * // server
		 * const { token } = await blob.uploadTokens.create({ prefix: "avatars/", security_hash: true });
		 * // browser
		 * await new SquareCloudBlob(token).put(fileInput.files[0], { name: "avatar" });
		 * ```
		 */
		create: (options: UploadTokenOptions = {}) =>
			this.request<UploadToken>("POST", "upload-tokens", { json: options }),
	};

	readonly shares = {
		/**
		 * Creates a revocable share link. If `object_is_public` comes back `true`,
		 * the password, download cap and expiration do NOT protect the file: it
		 * stays reachable at its public URL. Make it private first with `update()`.
		 */
		create: (object: string, options: ShareOptions = {}) =>
			this.request<Share>("POST", "shares", { json: { object, ...options } }),
		list: async () =>
			(await this.request<{ shares: ListedShare[] }>("GET", "shares")).shares,
		revoke: async (id: string) => {
			await this.request("DELETE", "shares", { json: { id } });
		},
	};

	/**
	 * The S3 key pair of this API key (API keys only). Deterministic per key, so
	 * it is fetched once per client; revoking or rotating the key kills it.
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
	 * A ready `S3Client` for the S3 gateway. Requires `@aws-sdk/client-s3`.
	 * Buckets: `public`, `private`, `legacy` (read, list, delete only).
	 */
	async s3(): Promise<S3Client> {
		const [{ S3Client }, credentials] = await Promise.all([
			import("@aws-sdk/client-s3"),
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
		// Lazy import keeps browser bundles free of node:fs; the Blob streams from disk
		const { openAsBlob } = await import("node:fs");
		try {
			return (await openAsBlob(file)) as Blob;
		} catch (cause) {
			throw new Error(`Cannot open file: ${file}`, { cause });
		}
	}
	return file instanceof Blob ? file : new Blob([file as BlobPart]);
}

export * from "./error.ts";
export * from "./types.ts";
