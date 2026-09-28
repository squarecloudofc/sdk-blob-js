import assert from "node:assert/strict";
import { SquareCloudBlob, SquareCloudBlobError } from "../src/index.ts";

// Offline checks against a stubbed fetch. Run with: pnpm test (no API key needed)

type Call = { method: string; url: URL; body: unknown };
let calls: Call[] = [];

function stub(handler: (call: Call) => [number, unknown]) {
	calls = [];
	globalThis.fetch = async (input, init) => {
		const call = {
			method: init?.method ?? "GET",
			url: new URL(String(input)),
			body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body,
		};
		calls.push(call);
		const [status, json] = handler(call);
		return new Response(JSON.stringify(json), { status });
	};
}

// Backoff waits are recorded and skipped
const delays: number[] = [];
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = ((fn: () => void, ms: number) => {
	delays.push(ms);
	return realSetTimeout(fn, 0);
}) as typeof setTimeout;

const ok = (response?: unknown) =>
	[200, { status: "success", response }] as [number, unknown];
const blob = new SquareCloudBlob("key", { maxRetries: 2 });

// Booleans go as "true"/"false" (false is meaningful), metadata as JSON, undefined dropped
stub(() => ok({ id: "pub/1/a.txt", size: 600 }));
await blob.put(new Uint8Array(600), {
	name: "a",
	private: false,
	metadata: { k: "v" },
	prefix: undefined,
	filename: "a.txt",
});
const query = calls[0].url.searchParams;
assert.equal(query.get("private"), "false");
assert.equal(query.get("metadata"), '{"k":"v"}');
assert.equal(query.has("prefix"), false);
assert.equal(query.has("filename"), false);
assert.equal(((calls[0].body as FormData).get("file") as File).name, "a.txt");

// 503 is retried, then succeeds
let attempt = 0;
stub(() =>
	attempt++ === 0
		? [503, { status: "error", code: "PUBLIC_STORAGE_UNAVAILABLE" }]
		: ok({ id: "x" }),
);
assert.deepEqual(await blob.info("x"), { id: "x" });
assert.equal(calls.length, 2);

// Any 429 is final, including the deprecated RATE_LIMIT
for (const code of ["RATE_LIMITED", "RATE_LIMIT"]) {
	stub(() => [429, { status: "error", code }]);
	await assert.rejects(blob.info("x"), { status: 429, code });
	assert.equal(calls.length, 1);
}

// 5xx is not retried on a non-idempotent call
stub(() => [500, { status: "error", code: "COPY_FAILED" }]);
await assert.rejects(blob.copy("a", { name: "b" }), { code: "COPY_FAILED" });
assert.equal(calls.length, 1);

// Network errors: retried on GET up to maxRetries, never on POST
const offline = () => {
	throw new TypeError("fetch failed");
};
stub(offline);
await assert.rejects(blob.stats(), { message: "fetch failed" });
assert.equal(calls.length, 3);
stub(offline);
await assert.rejects(blob.copy("a", { name: "b" }), {
	message: "fetch failed",
});
assert.equal(calls.length, 1);

// A body cut off mid-read is a network error: retried on GET, not an UNKNOWN_ERROR
let cut = 0;
globalThis.fetch = async () => {
	if (cut++ > 0) return new Response(JSON.stringify(ok({ id: "x" })[1]));
	const body = new ReadableStream({
		start(controller) {
			controller.enqueue(new TextEncoder().encode('{"status":"succ'));
			controller.error(new TypeError("terminated"));
		},
	});
	return new Response(body);
};
assert.deepEqual(await blob.info("x"), { id: "x" });
assert.equal(cut, 2);

// Backoff: min(8 s, 500 ms * 2^n) * U(0.5, 1.0)
const random = Math.random;
for (const [r, factor] of [
	[0, 0.5],
	[1, 1],
]) {
	Math.random = () => r;
	delays.length = 0;
	stub(() => [503, { status: "error", code: "PUBLIC_STORAGE_UNAVAILABLE" }]);
	await assert.rejects(new SquareCloudBlob("key", { maxRetries: 6 }).stats());
	assert.deepEqual(
		delays,
		[500, 1000, 2000, 4000, 8000, 8000].map((ms) => ms * factor),
	);
}
Math.random = random;

// 4xx is never retried; extra fields and status are exposed
stub(() => [
	400,
	{
		status: "error",
		code: "INVALID_RULE_PREFIX",
		message: "bad",
		prefix: "a/",
	},
]);
await assert.rejects(blob.rules.set([{ prefix: "a/" }]), (error) => {
	assert.ok(error instanceof SquareCloudBlobError);
	assert.equal(error.status, 400);
	assert.equal(error.code, "INVALID_RULE_PREFIX");
	assert.equal(error.message, "bad");
	assert.deepEqual(error.extra, { prefix: "a/" });
	assert.equal(error.isUpgradeRequired(), false);
	return true;
});
assert.equal(calls.length, 1);

// Non-JSON error page
globalThis.fetch = async () => new Response("<html>", { status: 403 });
await assert.rejects(blob.stats(), { code: "UNKNOWN_ERROR", status: 403 });

// Chunked: > 90 MB opens, sends every part once, completes without ETags
const big = new Blob([new Uint8Array(100 * 1024 * 1024)]);
const chunk = {
	min_size: 5242880,
	max_size: 33554432,
	max_parts: 2048,
	max_object_size: 0,
};
stub(({ method }) =>
	method === "POST"
		? ok({ upload: "h", id: "prv/1/f.bin", chunk })
		: ok({ id: "prv/1/f.bin", parts: 7 }),
);
const result = await blob.put(big, { name: "f" });
assert.equal(result.parts, 7);
assert.equal(calls[0].url.searchParams.get("filename"), "blob");
const parts = calls
	.filter((c) => c.method === "PUT")
	.map((c) => Number(c.url.searchParams.get("part")))
	.sort((a, b) => a - b);
assert.deepEqual(parts, [1, 2, 3, 4, 5, 6, 7]); // 16 MiB parts
assert.deepEqual(calls.at(-1)?.body, { upload: "h" });
assert.equal(calls.at(-1)?.method, "PATCH");

// Chunked: a part is retried on network errors, 5xx and TOO_MANY_CONCURRENT_CHUNKS
const tries: Record<string, number> = {};
stub(({ method, url }) => {
	const part = url.searchParams.get("part") ?? "";
	tries[part] = (tries[part] ?? 0) + 1;
	if (method === "POST") return ok({ upload: "h", id: "x", chunk });
	if (part === "3" && tries[part] === 1) offline();
	if (part === "3" && tries[part] === 2)
		return [500, { status: "error", code: "UPLOAD_FAILED" }];
	return ok({ id: "x", parts: 7 });
});
assert.equal((await blob.put(big, { name: "f" })).parts, 7);
assert.equal(tries["3"], 3);
// Each attempt re-sends the whole part (a Blob, readable again)
const resent = calls.filter((c) => c.url.searchParams.get("part") === "3");
for (const { body } of resent) {
	assert.ok(body instanceof Blob);
	assert.equal((await body.arrayBuffer()).byteLength, 16 * 1024 * 1024);
}

for (const k in tries) delete tries[k];
stub(({ method, url }) => {
	const part = url.searchParams.get("part") ?? "";
	tries[part] = (tries[part] ?? 0) + 1;
	if (method === "POST") return ok({ upload: "h", id: "x", chunk });
	if (part === "2" && tries[part] === 1)
		return [429, { status: "error", code: "TOO_MANY_CONCURRENT_CHUNKS" }];
	return ok({ id: "x", parts: 7 });
});
assert.equal((await blob.put(big, { name: "f" })).parts, 7);
assert.equal(tries["2"], 2);

// Chunked: a failed part aborts the upload
stub(({ method, url }) =>
	method === "POST"
		? ok({ upload: "h", id: "x", chunk })
		: method === "PUT" && url.searchParams.get("part") === "3"
			? [400, { status: "error", code: "EMPTY_CHUNK" }]
			: ok(),
);
await assert.rejects(blob.put(big, { name: "f" }), { code: "EMPTY_CHUNK" });
assert.equal(calls.at(-1)?.method, "DELETE");
assert.equal(
	calls.some((c) => c.method === "PATCH"),
	false,
);

// Chunked: the abort waits for the parts still in flight (none lands after it)
const events: string[] = [];
let releasePart2 = () => {};
const part2 = new Promise<void>((resolve) => {
	releasePart2 = resolve;
});
globalThis.fetch = async (input, init) => {
	const part = new URL(String(input)).searchParams.get("part");
	const method = init?.method ?? "GET";
	events.push(`${method} ${part ?? ""}`.trim());
	if (method === "POST") return Response.json(ok({ upload: "h", chunk })[1]);
	if (part === "2") {
		await part2;
		events.push("part 2 done");
	}
	if (part === "3") {
		realSetTimeout(releasePart2, 50);
		return Response.json(
			{ status: "error", code: "EMPTY_CHUNK" },
			{ status: 400 },
		);
	}
	return Response.json(ok()[1]);
};
await assert.rejects(blob.put(big, { name: "f" }), { code: "EMPTY_CHUNK" });
assert.deepEqual(events.slice(-2), ["part 2 done", "DELETE"]);

// A one-id batch delete is normalized to the batch shape
stub(() => [404, { status: "error", code: "OBJECT_NOT_FOUND" }]);
assert.deepEqual(await blob.delete(["a"]), {
	deleted: [],
	not_found: ["a"],
	failed: [],
});
await assert.rejects(blob.delete("a"), { code: "OBJECT_NOT_FOUND" });
// ...and a prefix refusal lands in `failed`, as in a real batch
stub(() => [403, { status: "error", code: "PREFIX_NOT_ALLOWED" }]);
assert.deepEqual(await blob.delete(["a"]), {
	deleted: [],
	not_found: [],
	failed: [{ id: "a", code: "PREFIX_NOT_ALLOWED" }],
});

// list() follows the cursor
stub(({ url }) =>
	url.searchParams.get("cursor")
		? ok({ objects: [{ id: "b" }] })
		: ok({ objects: [{ id: "a" }], continuationToken: "c1" }),
);
const ids: string[] = [];
for await (const object of blob.list()) ids.push(object.id);
assert.deepEqual(ids, ["a", "b"]);

// S3 credentials are fetched once
stub(() => ok({ access_key_id: "k" }));
await blob.s3Credentials();
await blob.s3Credentials();
assert.equal(calls.length, 1);

console.log("All offline checks passed");
