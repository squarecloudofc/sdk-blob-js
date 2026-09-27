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

// A one-id batch delete is normalized to the batch shape
stub(() => [404, { status: "error", code: "OBJECT_NOT_FOUND" }]);
assert.deepEqual(await blob.delete(["a"]), {
	deleted: [],
	not_found: ["a"],
	failed: [],
});
await assert.rejects(blob.delete("a"), { code: "OBJECT_NOT_FOUND" });

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
