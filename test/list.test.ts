import type { ListObjectsOptions } from "../src";
import { blob } from "./index.test";

const listOptions: ListObjectsOptions = {
	prefix: "test",
};

// List objects with filter by prefix

blob.objects.list(listOptions).then(console.log);

// List all objects

blob.objects.list().then(console.log);
