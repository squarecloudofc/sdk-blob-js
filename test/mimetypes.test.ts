import { MimeTypeUtil } from "../src";

// Get supported mime type for certain file extension

console.log(MimeTypeUtil.fromExtension("png")); // "image/png"
console.log(MimeTypeUtil.fromExtension("potato")); // "text/plain" (unsupported, defaults to text/plain)
console.log(MimeTypeUtil.fromExtension("txt")); // "text/plain"
console.log(MimeTypeUtil.fromExtension("wav")); // "audio/wav"
console.log(MimeTypeUtil.fromExtension("md")); // "text/plain" (unsupported, defaults to text/plain)
console.log(MimeTypeUtil.fromExtension("json")); // "application/json"
