import assert from "node:assert/strict";
import { MimeTypes, MimeTypeUtil, SquareCloudBlob } from "../src";
import { SquareCloudBlobError } from "../src/structures/error";
import { parseObjectUrl } from "../src/utils/object-url";

// Offline checks: client-side validation, error codes and object URL parsing.
// Run with: pnpm test ./test/validation.test.ts (no API key needed)

const blob = new SquareCloudBlob("fake-key");
const file = Buffer.alloc(2048);

async function expectCode(promise: Promise<unknown>, code: string) {
	await assert.rejects(promise, (error: unknown) => {
		assert.ok(error instanceof SquareCloudBlobError);
		assert.equal(error.code, code);
		return true;
	});
}

async function main() {
	await expectCode(
		blob.objects.create({ file, name: "ab", mimeType: MimeTypes.TEXT_PLAIN }),
		"INVALID_OBJECT_NAME",
	);
	await expectCode(
		blob.objects.create({
			file,
			name: "valid_name",
			prefix: "no",
			mimeType: MimeTypes.TEXT_PLAIN,
		}),
		"INVALID_OBJECT_PREFIX",
	);
	await expectCode(
		blob.objects.create({
			file,
			name: "valid_name",
			expiresIn: 366,
			mimeType: MimeTypes.TEXT_PLAIN,
		}),
		"INVALID_OBJECT_EXPIRE",
	);
	await expectCode(
		blob.objects.create({
			file: Buffer.alloc(100),
			name: "valid_name",
			mimeType: MimeTypes.TEXT_PLAIN,
		}),
		"FILE_TOO_SMALL",
	);
	await expectCode(
		blob.objects.create({
			file: Buffer.alloc(100 * 1024 * 1024 + 1),
			name: "valid_name",
			mimeType: MimeTypes.TEXT_PLAIN,
		}),
		"FILE_TOO_LARGE",
	);
	await expectCode(
		blob.objects.create({ file, name: "valid_name" }),
		"MIME_TYPE_REQUIRED",
	);

	const parsed = parseObjectUrl(
		"https://public-blob.squarecloud.dev/123456/backups/db_a1b2c3-ex30.sqlite3",
	);
	assert.equal(parsed.userId, "123456");
	assert.equal(parsed.prefix, "backups");
	assert.equal(parsed.expiration, 30);
	// The id must round-trip exactly (used by objects.delete)
	assert.equal(parsed.id, "123456/backups/db_a1b2c3-ex30.sqlite3");

	assert.equal(MimeTypeUtil.fromExtension("m4a"), "audio/mp4");
	assert.equal(new SquareCloudBlobError("RATE_LIMITED").code, "RATE_LIMITED");

	console.log("All validation checks passed");
}

main();
