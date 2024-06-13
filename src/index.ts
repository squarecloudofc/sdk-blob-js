import { APIManager } from "./managers/api";
import { BlobObjectsManager } from "./managers/objects";

export class SquareCloudBlob {
	public static apiInfo = {
		baseUrl: "https://blob.squarecloud.app",
		version: "v1",
	};

	public readonly api: APIManager;
	public readonly objects = new BlobObjectsManager(this);

	constructor(apiKey: string) {
		this.api = new APIManager(apiKey);
	}
}

export * from "./types/list";
export * from "./types/put";
export { MimeTypes } from "./utils/mimetype";
