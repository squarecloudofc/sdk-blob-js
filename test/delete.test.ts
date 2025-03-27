import { blob } from "./index.test";

const objectToDelete: string = "test.png";

// Delete object
blob.objects.delete(objectToDelete).then(console.log);
