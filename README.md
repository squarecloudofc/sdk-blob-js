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
const blobObject = await blob.objects.put({
  file: "path/to/file.png", // Absolute path to your file, Buffer or Blob
  name: "my_image.png" // File name with extension
})

console.log(blobObject.url)
```

### Deleting objects

```ts
// List of objects to delete (Limit of 100 per request)
const objectsToDelete = [
  "ID/prefix/name1_xxx-xxx.mp4",
  "ID/prefix/name_xxx-xxx-xxx.png"
]

await blob.objects.delete(objectsToDelete)
```

## Contributing

Feel free to contribute with suggestions or bug reports at our [GitHub repository](https://github.com/squarecloudofc/sdk-blob-js).

## Authors

- [@joaotonaco](https://github.com/joaotonaco)