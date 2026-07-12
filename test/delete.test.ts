import { blob } from "./index.test";

// Object id ("userId/key") or public URL
const objectToDelete: string = "1234567890/prefix/name_hash.png";

// Delete object (throws OBJECT_NOT_FOUND if it does not exist)
blob.objects.delete(objectToDelete).then(console.log);
