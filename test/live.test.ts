import assert from "node:assert/strict";
import { SquareCloudBlob } from "../src/index.ts";

// Round trip against the real API, cleaning up after itself.
// Run with: pnpm test:live (needs SQUARECLOUD_API_KEY in .env and a paid plan)

const blob = new SquareCloudBlob(process.env.SQUARECLOUD_API_KEY as string);
console.log(await blob.stats());

const uploaded = await blob.put(
	new TextEncoder().encode("content".repeat(100)),
	{
		name: "sdk_live_test",
		prefix: "sdk-test",
		filename: "test.txt",
		security_hash: true,
	},
);
try {
	assert.equal((await blob.info(uploaded.id)).size, 700);
	assert.ok((await blob.downloadUrl(uploaded.id)).url);
	console.log(await blob.listPage({ prefix: "sdk-test/", limit: 5 }));
} finally {
	await blob.delete(uploaded.id);
}

console.log("Live round trip passed");
