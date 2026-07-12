import { type CreateObjectOptions, MimeTypes } from "../src";
import { blob } from "./index.test";

// Create object using absolute path

const createWithPathPayload: CreateObjectOptions = {
	file: "package.json",
	name: "testing",
};

blob.objects.create(createWithPathPayload).then(console.log);

// Create object using buffer

const createWithBufferPayload: CreateObjectOptions = {
	file: Buffer.from("content".repeat(100)),
	name: "testing",
	mimeType: MimeTypes.TEXT_PLAIN,
};

blob.objects.create(createWithBufferPayload).then(console.log);
