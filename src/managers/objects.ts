import type { SquareCloudBlob } from "..";
import {
	SquareCloudBlobError,
	SquareCloudValidationError,
} from "../structures/error";
import { BlobObject } from "../structures/object";
import type {
	CreateObjectOptions,
	CreateObjectResponse,
} from "../types/create";
import type { ListObjectsOptions, ListObjectsResponse } from "../types/list";
import { parseObjectUrl } from "../utils/object-url";
import { parsePathLike } from "../utils/path-like";
import { makeCreateObjectPayload } from "../utils/payloads";

/** The API allows at most 4 concurrent uploads per user. */
const MAX_CONCURRENT_UPLOADS = 4;
const MIN_FILE_SIZE = 1024;
const MAX_FILE_SIZE = 100 * 1024 * 1024;

export class ObjectsManager {
	private activeUploads = 0;
	private uploadQueue: (() => void)[] = [];

	constructor(private readonly client: SquareCloudBlob) {}

	/**
	 * Lists objects in the storage. Results are paginated: when
	 * `continuationToken` is returned, pass it back to fetch the next page.
	 *
	 * Note: the listing is cached server-side for ~30 minutes, so changes made
	 * outside this SDK may take a while to show up.
	 *
	 * @example
	 * ```js
	 * let page = await blob.objects.list();
	 *
	 * while (page.continuationToken) {
	 * 	page = await blob.objects.list({ continuationToken: page.continuationToken });
	 * }
	 * ```
	 */
	async list(options?: ListObjectsOptions) {
		const { objects, continuationToken } =
			await this.client.api.request<ListObjectsResponse>("objects", {
				params: options,
			});

		return {
			objects: objects.map(
				(objectData) =>
					new BlobObject({
						idOrUrl: objectData.id,
						size: objectData.size,
						createdAt: new Date(objectData.created_at),
						expiresAt: objectData.expires_at
							? new Date(objectData.expires_at)
							: undefined,
					}),
			),
			continuationToken,
		};
	}

	/**
	 * Uploads an object to the storage. Requires a paid plan.
	 *
	 * The SDK queues uploads so at most 4 run concurrently (the API limit) and
	 * automatically retries with backoff when the API reports too many
	 * concurrent uploads.
	 *
	 * Note: `text/html` and `image/svg+xml` files are stored as
	 * `application/octet-stream`, so their public URL downloads the file
	 * instead of rendering it. The same applies to any file uploaded with
	 * `autoDownload: true`.
	 *
	 * @param options - An object to upload
	 *
	 * @example
	 * ```js
	 * // Basic usage with absolute path
	 * blob.objects.create({
	 * 	file: "path/to/file.jpeg",
	 * 	name: "my_image"
	 * });
	 *
	 * // Advanced usage with Buffer
	 * blob.objects.create({
	 * 	file: Buffer.from("content"),
	 * 	name: "my_image",
	 * 	mimeType: "image/jpeg"
	 * })
	 * ```
	 */
	async create(options: CreateObjectOptions) {
		if (Buffer.isBuffer(options.file) && !options.mimeType) {
			throw new SquareCloudBlobError(
				"MIME_TYPE_REQUIRED",
				"Mime type is required when using a Buffer",
			);
		}

		const payload = makeCreateObjectPayload(options);
		const file = await parsePathLike(payload.file);

		if (file.byteLength < MIN_FILE_SIZE) {
			throw new SquareCloudValidationError(
				"FILE_TOO_SMALL",
				"Files must be at least 1 KiB",
			);
		}
		if (file.byteLength > MAX_FILE_SIZE) {
			throw new SquareCloudValidationError(
				"FILE_TOO_LARGE",
				"Files must be at most 100 MB",
			);
		}

		const formData = new FormData();
		formData.append(
			"file",
			new Blob([new Uint8Array(file)], { type: payload.mimeType }),
		);

		await this.acquireUploadSlot();
		try {
			const response = await this.requestUploadWithRetry(
				formData,
				payload.params,
			);

			return new BlobObject({
				idOrUrl: response.id,
				size: response.size,
			});
		} finally {
			this.releaseUploadSlot();
		}
	}

	/**
	 * Deletes an object from the storage. Accepts the object id or its public
	 * URL. Deleting an object that does not exist throws `OBJECT_NOT_FOUND`.
	 *
	 * The API deletes one object per request; to delete many, call this method
	 * for each object sequentially.
	 *
	 * @param object - The object id (`userId/key`) or public URL
	 *
	 * @example
	 * ```js
	 * blob.objects.delete("userId/prefix/name_hash.png");
	 * ```
	 */
	async delete(object: string) {
		let id = object;
		try {
			id = parseObjectUrl(object).id;
		} catch {
			// ponytail: unparseable input goes through as-is; the API answers INVALID_OBJECT
		}

		await this.client.api.request("objects", {
			method: "DELETE",
			body: { object: id },
		});
	}

	private async requestUploadWithRetry(
		body: FormData,
		params: Record<string, string | number | boolean | undefined>,
	) {
		// ponytail: backoff schedule totals ~2min, matching the API's stuck-slot auto-heal window
		for (let attempt = 0; ; attempt++) {
			try {
				return await this.client.api.request<CreateObjectResponse>("objects", {
					method: "POST",
					body,
					params,
				});
			} catch (error) {
				const retryable =
					error instanceof SquareCloudBlobError &&
					error.code === "TOO_MANY_CONCURRENT_UPLOADS" &&
					attempt < 8;

				if (!retryable) {
					throw error;
				}

				await new Promise((resolve) =>
					setTimeout(resolve, Math.min(2 ** attempt, 30) * 1000),
				);
			}
		}
	}

	private async acquireUploadSlot() {
		if (this.activeUploads >= MAX_CONCURRENT_UPLOADS) {
			await new Promise<void>((resolve) => this.uploadQueue.push(resolve));
		}
		this.activeUploads++;
	}

	private releaseUploadSlot() {
		this.activeUploads--;
		this.uploadQueue.shift()?.();
	}
}
