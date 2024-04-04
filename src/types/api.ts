export type APIRequestInit = Omit<RequestInit, "method" | "body"> & {
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	params?: Record<string, string>;
	body?: object | FormData;
};

export type APIPayload<TResponse = unknown> = {
	status: "success" | "error";
	response: TResponse;
	code?: string;
};
