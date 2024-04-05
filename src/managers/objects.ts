import { readFile } from "fs/promises";
import type { SquareCloudBlob } from "..";
import { assertPutObjectResponse } from "../assertions/put";
import { putObjectPayloadSchema } from "../schemas/put";
import { SquareCloudBlobError } from "../structures/error";
import type { PutObjectResponse, PutObjectType } from "../types/put";

export class BlobObjectsManager {
	constructor(private readonly client: SquareCloudBlob) {}

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
