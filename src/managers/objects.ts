import type { SquareCloudBlob } from "..";
import { BlobObject } from "../structures/object";
import type { CreateObjectResponse, CreateObjectType } from "../types/create";
import type { ListObjectsResponse, ListObjectsType } from "../types/list";
import { parsePathLike } from "../utils/path-like";
import { assertCreateObjectResponse } from "../validation/assertions/create";
import { assertListObjectsResponse } from "../validation/assertions/list";
import { createObjectPayloadSchema } from "../validation/schemas/create";
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

		const { response } = await this.client.api.request<ListObjectsResponse>(
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
	 * @param object - An object to upload
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
	async create(object: CreateObjectType) {
		const payload = createObjectPayloadSchema.parse(object);
		const file = await parsePathLike(payload.file);
		const type = payload.mimeType || object.mimeType;

		const formData = new FormData();
		formData.append("file", new Blob([file], { type }));

		const { response } = await this.client.api.request<CreateObjectResponse>(
			"objects",
			{ method: "POST", body: formData, params: payload.params },
		);

		const objectData = assertCreateObjectResponse(response);

		return new BlobObject({
			idOrUrl: objectData.id,
			size: objectData.size,
		});
	}

	/**
	 * Deletes multiple objects.
	 *
	 * @param objects - An array of object IDs
	 *
	 * @example
	 * ```js
	 * blob.objects.delete([
	 * 	"userId/prefix/name1_xxx-xxx.mp4",
	 * 	"userId/prefix/name_xxx-xxx-xxx.png"
	 * ]);
	 * ```
	 */
	async delete(objects: string[]) {
		const { status } = await this.client.api.request("objects", {
			method: "DELETE",
			body: { objects },
		});

		return status === "success";
	}
}
