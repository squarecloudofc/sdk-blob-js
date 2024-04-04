export type APIRequestInit = Omit<RequestInit, "method" | "body"> & {
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	params?: Record<string, string | number | boolean | undefined>;
	body?: object | FormData;
};

export type APIPayload<TResponse = unknown> =
	| {
			status: "success";
			response?: TResponse;
	  }
	| {
			status: "error";
			code: string;
	  };
