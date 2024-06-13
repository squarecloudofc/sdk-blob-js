import { APIManager } from "./managers/api";
import { ObjectsManager } from "./managers/objects";

export class SquareCloudBlob {
	public static apiInfo = {
		baseUrl: "https://blob.squarecloud.app",
		version: "v1",
	};

	public readonly api: APIManager;
	public readonly objects = new ObjectsManager(this);

	constructor(apiKey: string) {
		this.api = new APIManager(apiKey);
	}
}

export * from "./types/create";
export * from "./types/list";
export { MimeTypes } from "./utils/mimetype";
