import type { SquareCloudBlob } from "..";
import { BlobObject } from "../structures/object";
import type { CreateObjectResponse, CreateObjectType } from "../types/create";
import type { ListObjectsResponse } from "../types/list";
import { MimeTypeUtil } from "../utils/mimetype";
import { parsePathLike } from "../utils/path-like";
import { assertCreateObjectResponse } from "../validation/assertions/create";
import { assertListObjectsResponse } from "../validation/assertions/list";
import { createObjectPayloadSchema } from "../validation/schemas/create";

export class ObjectsManager {
	constructor(private readonly client: SquareCloudBlob) {}

	/**
	 * Lists all objects in the storage.
	 *
	 * @example
	 * ```js
	 * const objects = await blob.objects.list();
	 * ```
	 */
	async list() {
		const { response } =
			await this.client.api.request<ListObjectsResponse>("objects");
		const list = assertListObjectsResponse(response);

		if (!list.objects) {
			return [];
		}

		return list.objects.map(
			(object) =>
				new BlobObject({
					idOrUrl: object.id,
					size: object.size,
					createdAt: new Date(object.created_at),
					expiresAt: object.expires_at
						? new Date(object.expires_at)
						: undefined,
				}),
		);
	}

	/**
	 * Uploads an object to the storage.
	 *
	 * @param object - An object to upload
	 *
	 * @example
	 * ```js
	 * await blob.objects.create({ file: "path/to/file.jpeg", name: "my_image" });
	 * ```
	 */
	async create(object: CreateObjectType) {
		const payload = createObjectPayloadSchema.parse(object);
		const file = await parsePathLike(payload.file);
		const mimeType =
			typeof object.file === "string"
				? MimeTypeUtil.fromExtension(object.file.split(".")[1])
				: object.mimeType;

		const formData = new FormData();
		formData.append("file", new Blob([file], { type: mimeType }));

		const { response } = await this.client.api.request<CreateObjectResponse>(
			"objects",
			{
				method: "POST",
				body: formData,
				params: payload.params,
			},
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
	 * await blob.objects.delete("ID/prefix/name1_xxx-xxx.mp4", "ID/prefix/name_xxx-xxx-xxx.png");
	 * ```
	 */
	async delete(...objects: string[] | string[][]) {
		const ids = objects.flat();

		const { status } = await this.client.api.request("objects", {
			method: "DELETE",
			body: { objects: ids },
		});

		return status === "success";
	}
}
