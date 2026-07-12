<div align="center">
  <img alt="Square Cloud Banner" src="https://cdn.squarecloud.app/png/github-readme.png">
</div>

<h1 align="center">@squarecloud/blob</h1>

<p align="center">Official <a href="https://squarecloud.app" target="_blank">Square Cloud</a> Blob SDK for NodeJS.</p>

<div align="center">
  <div style="width: fit-content; display: flex; align-items: flex-start; gap: 4px;">
    <img alt="NPM License" src="https://img.shields.io/npm/l/@squarecloud/blob">
    <img alt="NPM Downloads" src="https://img.shields.io/npm/dw/@squarecloud/blob">
    <a href="https://npmjs.com/package/@squarecloud/blob">
      <img alt="NPM Version" src="https://img.shields.io/npm/v/@squarecloud/blob">
    </a>
  </div>
</div>

## Installation

```bash
npm install @squarecloud/blob
// or
yarn add @squarecloud/blob
// or
pnpm add @squarecloud/blob
```

## Documentation

Visit our [official API documentation](https://docs.squarecloud.app/en/blob-reference/authentication) for more information about this service.

## Getting Started

- _Login and get your API Key at [https://squarecloud.app/account](https://squarecloud.app/account)._

```ts
import { SquareCloudBlob } from "@squarecloud/blob"
// CommonJS => const { SquareCloudBlob } = require("@squarecloud/blob");

const blob = new SquareCloudBlob("Your API Key")
const { objects } = await blob.objects.list()
```

### Listing objects

Listing is paginated: when `continuationToken` is returned, pass it back to fetch the next page. The listing is cached server-side for ~30 minutes, so changes made outside the SDK may take a while to show up.

```ts
let page = await blob.objects.list({ prefix: "my_prefix" }) // prefix is optional
console.log(page.objects)

while (page.continuationToken) {
  page = await blob.objects.list({ continuationToken: page.continuationToken })
  console.log(page.objects)
}
```

### Creating an object

- _Check supported file types [here](https://docs.squarecloud.app/en/services/blob#supported-file-extensions)._
- _Uploading requires a paid plan._

```ts
const blobObject = await blob.objects.create({
  file: "path/to/file.png", // Absolute path to your file
  name: "my_image",         // File name without extension (a-z, A-Z, 0-9, _, 3-32 chars)
  prefix: "my_prefix",      // Optional prefix (same pattern as name)
  expiresIn: 30,            // Optional expiration in days (1-365)
  securityHash: true,       // Optional: append a security hash to the file name
  autoDownload: true,       // Optional: public URL downloads the file instead of rendering it
})

console.log(blobObject.url)
```

> [!NOTE]
> For safety reasons, `text/html` and `image/svg+xml` files are always stored as `application/octet-stream`: their public URL **downloads** the file instead of rendering it inline.

Files must be between 1 KiB and 100 MB. The API allows at most 4 concurrent uploads per user — the SDK queues uploads to respect this limit and automatically retries with backoff when the API reports too many concurrent uploads.

#### Advanced usage with Buffer

```ts
import { MimeTypes } from "@squarecloud/blob"
// CommonJS => const { MimeTypes } = require("@squarecloud/blob")

const blobObject = await blob.objects.create({
  file: Buffer.from("content"),
  name: "my_image",
  mimeType: MimeTypes.IMAGE_JPEG, // Also accepts an string "image/jpeg"
})

console.log(blobObject.url)
```

### Deleting object

Accepts the object id (`userId/key`) or its public URL. Deleting an object that does not exist throws an error with code `OBJECT_NOT_FOUND`. The API deletes one object per request — to delete many, call it for each object sequentially.

```ts
await blob.objects.delete("ID/prefix/name1_xxx-xxx.mp4")
```

### Handling errors

API and validation errors throw `SquareCloudBlobError`, which exposes the raw API error code via `error.code`:

```ts
import { SquareCloudBlobError } from "@squarecloud/blob"

try {
  await blob.objects.delete("ID/my_file.png")
} catch (error) {
  if (error instanceof SquareCloudBlobError && error.code === "OBJECT_NOT_FOUND") {
    // Already gone
  }
}
```

### Extras

#### Mime types handling

- _Check supported file types [here](https://docs.squarecloud.app/en/services/blob#supported-file-extensions)._

```ts
import { MimeTypeUtil } from "@squarecloud/blob"

// Get a supported mime type from a file extension
console.log(MimeTypeUtil.fromExtension("jpeg"))   // "image/jpeg"       | Supported
console.log(MimeTypeUtil.fromExtension("json"))   // "application/json" | Supported
console.log(MimeTypeUtil.fromExtension("potato")) // "text/plain"       | Unsupported, defaults to text/plain
```

## Contributing

Feel free to contribute with suggestions or bug reports at our [GitHub repository](https://github.com/squarecloudofc/sdk-blob-js).

## Authors

- [@joaotonaco](https://github.com/joaotonaco)