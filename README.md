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

Visit our [official API documentation](https://docs.squarecloud.app/blob-reference/) for more information about this service.

## Getting Started

- _Login and get your API Key at [https://squarecloud.app/account](https://squarecloud.app/account)._

```ts
import { SquareCloudBlob } from "@squarecloud/blob"
// CommonJS => const { SquareCloudBlob } = require("@squarecloud/blob");

const blob = new SquareCloudBlob("Your API Key")
const objects = await blob.objects.list()
```

### Creating an object

- _Check supported file types [here](https://docs.squarecloud.app/services/blob#supported-file-types)._

```ts
const blobObject = await blob.objects.create({
  file: "path/to/file.png", // Absolute path to your file
  name: "my_image",         // File name without extension
})

console.log(blobObject.url)
```

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

```ts
await blob.objects.delete("ID/prefix/name1_xxx-xxx.mp4")
```

### Extras

#### Mime types handling

- _Check supported file types [here](https://docs.squarecloud.app/services/blob#supported-file-types)._

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