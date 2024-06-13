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
		const { init, params } = this.parseOptions(options);
		const url = new URL(`${path}?${params}`, this.baseUrl);

		const response = await fetch(url, init);
		const data: APIPayload<T> = await response.json();

		if (data.status === "error") {
			throw new SquareCloudBlobError(data.code || "UNKNOWN_ERROR");
		}
		return data;
	}

	private parseOptions(options: APIRequestInit) {
		const paramsObject =
			options.params &&
			Object.fromEntries(
				Object.entries(options.params)
					.filter(([, value]) => Boolean(value))
					.map(([key, value]) => [key, String(value)]),
			);
		const params = new URLSearchParams(paramsObject);

		const { params: _, headers, body, ...rest } = options;

		const init: RequestInit = {
			...rest,
			headers: { ...(headers || {}), Authorization: this.apiKey },
		};

		if (body) {
			init.body = body instanceof FormData ? body : JSON.stringify(body);
		}

		return { init, params };
	}
}
