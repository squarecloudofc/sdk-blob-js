import { SquareCloudBlob } from "..";
import { SquareCloudBlobError } from "../structures/error";
import type { APIPayload, APIRequestInit } from "../types/api";

export class APIManager {
	public readonly baseUrl: string;

	constructor(private readonly apiKey: string) {
		const { baseUrl, version } = SquareCloudBlob.apiInfo;
		this.baseUrl = `${baseUrl}/${version}/`;
	}

	async request<T>(path: string, options: APIRequestInit = {}) {
		const params = new URLSearchParams(options.params).toString();
		const url = new URL(`${path}?${params}`, this.baseUrl);
		const init = this.parseOptions(options);

		const response = await fetch(url, init);
		const data: APIPayload<T> = await response.json();

		if (data.status === "error") {
			throw new SquareCloudBlobError(data.code || "UNKNOWN_ERROR");
		}
		return data;
	}

	private parseOptions(options: APIRequestInit) {
		const { method, headers, body, ...rest } = options;
		const init: RequestInit = {
			method: method || "GET",
			headers: { Authorization: this.apiKey, ...(headers || {}) },
			...rest,
		};

		if (body) {
			init.body = body instanceof FormData ? body : JSON.stringify(body);
		}

		return init;
	}
}
