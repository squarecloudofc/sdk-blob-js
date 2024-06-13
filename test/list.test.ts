import type { ListObjectsType } from "../src";
import { blob } from "./index.test";

const listOptions: ListObjectsType = {
	prefix: "test",
};

// List objects with filter by prefix

blob.objects.list(listOptions).then(console.log);

// List all objects

blob.objects.list().then(console.log);
