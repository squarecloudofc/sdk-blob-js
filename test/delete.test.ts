import { blob } from "./index.test";

const objectsToDelete: string[] = [];

// Delete objects

blob.objects.delete(objectsToDelete).then(console.log);
