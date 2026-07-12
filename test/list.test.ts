import type { ListObjectsOptions } from "../src";
import { blob } from "./index.test";

const listOptions: ListObjectsOptions = {
	prefix: "test",
};

// List objects with filter by prefix

blob.objects.list(listOptions).then(console.log);

// List all objects, following pagination

async function listAll() {
	let page = await blob.objects.list();
	console.log(page.objects);

	while (page.continuationToken) {
		page = await blob.objects.list({
			continuationToken: page.continuationToken,
		});
		console.log(page.objects);
	}
}

listAll();
