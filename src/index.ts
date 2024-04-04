import { APIManager } from "./managers/api";

export class SquareCloudBlob {
	public static apiInfo = {
		baseUrl: "https://blob.squarecloud.app",
		version: "v1",
	};

	public readonly api: APIManager;

	constructor(apiKey: string) {
		this.api = new APIManager(apiKey);
	}
}
