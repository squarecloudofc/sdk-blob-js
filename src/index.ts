import { APIManager } from "./managers/api";
import { ObjectsManager } from "./managers/objects";
import type { StatsResponse } from "./types/stats";

export class SquareCloudBlob {
	public readonly api: APIManager;
	public readonly objects = new ObjectsManager(this);

	constructor(apiKey: string) {
		this.api = new APIManager(apiKey);
	}

	async stats() {
		return this.api.request<StatsResponse>("account/stats");
	}
}

export * from "./structures/error";
export * from "./structures/object";
export * from "./types/create";
export * from "./types/list";
export * from "./utils/mimetype";
