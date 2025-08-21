import type { SquareCloudBlob } from "..";
import { SquareCloudBlobError } from "../structures/error";
import { BlobObject } from "../structures/object";
import type {
	CreateObjectOptions,
	CreateObjectResponse,
} from "../types/create";
import type { ListObjectsResponse, ListObjectsType } from "../types/list";
import { parsePathLike } from "../utils/path-like";
import { makeCreateObjectPayload } from "../utils/payloads";
import { assertListObjectsResponse } from "../validation/assertions/list";
import { listObjectsPayloadSchema } from "../validation/schemas/list";

export class ObjectsManager {
	constructor(private readonly client: SquareCloudBlob) {}

	/**
	 * Lists all objects in the storage.
	 *
	 * @example
	 * ```js
	 * blob.objects.list();
	 * ```
	 */
	async list(options?: ListObjectsType) {
		const payload = listObjectsPayloadSchema.parse(options);

		const response = await this.client.api.request<ListObjectsResponse>(
			"objects",
			{ params: payload.params },
		);
		const { objects } = assertListObjectsResponse(response);

		return objects.map((objectData) => {
			const createdAt = new Date(objectData.created_at);
			const expiresAt = objectData.expires_at
				? new Date(objectData.expires_at)
				: undefined;

			return new BlobObject({
				idOrUrl: objectData.id,
				size: objectData.size,
				createdAt,
				expiresAt,
			});
		});
	}

	/**
	 * Uploads an object to the storage.
	 *
	 * @param data - An object to upload
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
	async create(data: CreateObjectOptions) {
		if (data.file instanceof Buffer && !data.mimeType) {
			throw new SquareCloudBlobError(
				"MIME_TYPE_REQUIRED",
				"Mime type is required when using a Buffer",
			);
		}

		const payload = makeCreateObjectPayload(data);
		const file = await parsePathLike(payload.file);
		const type = payload.mimeType || data.mimeType;

		const formData = new FormData();
		formData.append("file", new Blob([new Uint8Array(file)], { type }));

		const response = await this.client.api.request<CreateObjectResponse>(
			"objects",
			{ method: "POST", body: formData, params: payload.params },
		);

		return new BlobObject({
			idOrUrl: response.id,
			size: response.size,
		});
	}

	/**
	 * Delete an object from the storage.
	 *
	 * @param object - An array of object IDs
	 *
	 * @example
	 * ```js
	 * blob.object.delete("userId/prefix/name1_xxx-xxx.mp4");
	 * ```
	 */
	async delete(object: string) {
		await this.client.api.request("objects", {
			method: "DELETE",
			body: { object },
		});
	}
}
