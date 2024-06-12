import { readFile } from "fs/promises";
import type { SquareCloudBlob } from "..";
import { assertListObjectsResponse } from "../assertions/list";
import { assertPutObjectResponse } from "../assertions/put";
import { putObjectPayloadSchema } from "../schemas/put";
import { SquareCloudBlobError } from "../structures/error";
import type { ListObjectsResponse } from "../types/list";
import type { PutObjectResponse, PutObjectType } from "../types/put";

export class BlobObjectsManager {
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
			await this.client.api.request<ListObjectsResponse>("list");

		return assertListObjectsResponse(response)?.objects;
	}

	/**
	 * Uploads an object to the storage.
	 *
	 * @param object - An object to upload
	 *
	 * @example
	 * ```js
	 * await blob.objects.put({ file: "path/to/file.jpeg", name: "my_image" });
	 * ```
	 */
	async put(object: PutObjectType) {
		const payload = putObjectPayloadSchema.parse(object);
		const file = await this.parseFile(payload.file);

		const formData = new FormData();
		formData.append("file", new Blob([file]));

		const { response } = await this.client.api.request<PutObjectResponse>(
			"put",
			{ method: "PUT", body: formData, params: payload.params },
		);

		return assertPutObjectResponse(response);
	}

	/**
	 * Deletes multiple objects.
	 *
	 * @param objects - An array of object IDs
	 *
	 * @example
	 * ```js
	 * await blob.objects.delete("ID/prefix/name1_xxx-xxx.zip", "ID/prefix/name_xxx-xxx-xxx.png");
	 * ```
	 */
	async delete(...objects: string[] | string[][]) {
		const ids = objects.flat();

		const response = await this.client.api.request("delete", {
			method: "DELETE",
			body: { objects: ids },
		});

		return response.status === "success";
	}

	private async parseFile(file: string | Buffer) {
		let result: Buffer | undefined;

		if (typeof file === "string") {
			result = await readFile(file).catch(() => undefined);
		}

		if (!result) {
			throw new SquareCloudBlobError("INVALID_FILE", "File not found");
		}

		return result;
	}

	parseObjectUrl(url: string) {
		const pattern =
			/^https:\/\/public-blob\.squarecloud\.dev\/([^\/]+)\/([^\/]+\/)?([^_]+)_[\w-]+\.\w+$/;
		const match = pattern.exec(url);

		if (!match) {
			throw new SquareCloudBlobError(
				"INVALID_BLOB_URL",
				"Invalid blob object URL",
			);
		}

		let [, id, prefix, name] = match;
		prefix = prefix ? prefix.slice(0, -1) : "";

		return { id, prefix, name };
	}
}
