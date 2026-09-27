<div align="center">
  <img alt="Square Cloud Banner" src="https://cdn.squarecloud.app/png/github-readme.png">
</div>

<h1 align="center">@squarecloud/blob</h1>

<p align="center">Official <a href="https://squarecloud.app" target="_blank">Square Cloud</a> Blob SDK for Node.js and browsers.</p>

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
# or
yarn add @squarecloud/blob
# or
pnpm add @squarecloud/blob
```

> Requires Node.js 20 or newer.

## Documentation

Visit our [official API documentation](https://docs.squarecloud.app/en/blob-reference/authentication) for more information about this service.

## Getting Started

- _Login and get your API Key at [https://squarecloud.app/account](https://squarecloud.app/account)._

```ts
import { SquareCloudBlob } from "@squarecloud/blob"
// CommonJS => const { SquareCloudBlob } = require("@squarecloud/blob")

const blob = new SquareCloudBlob("Your API Key")
```

Options and results use the API's field names (`security_hash`, `expires_at`, ...), so the API documentation applies as-is.

### Object ids

An object's `id` (e.g. `pub/<owner>/avatars/photo.png`) is opaque: store it as returned and never build or parse it. **Making an object public/private or changing its expiration changes its id**, so always replace your stored id with the one returned. Use the `url` field of a response instead of building URLs; private objects have `url: null` (see `downloadUrl()`).

### Uploading

```ts
const { id, url } = await blob.put("path/to/photo.png", {
  name: "photo",       // Without extension: ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$
  prefix: "avatars",   // Optional, up to 8 segments
  private: false,      // Private objects always get a security hash
  security_hash: true, // Appends _<hash> to the name
  expire: "30d",       // "30", "30d" or "168h"; 7d to 1825d
  overwrite: false,    // Fails with OBJECT_ALREADY_EXISTS if the name is taken
})
```

`put()` accepts a file path (Node.js), a `Blob`/`File`, or bytes (`Uint8Array`, `Buffer`, `ArrayBuffer`). The extension comes from the file name, so pass `filename` (e.g. `"data.json"`) when uploading bytes. The server derives the Content-Type; `html`, `svg` and `xml` are served as `application/octet-stream`.

Files must be at least 512 B. Files above ~90 MB are uploaded in parts automatically (up to 10 GiB, 6 parts in parallel); if a part fails for good, the upload is aborted.

Other options: `disposition`, `auto_download`, `cache_control`, `metadata` (Pro/Enterprise) and `checksum_sha256`.

### Uploading from the browser

Create a short-lived upload token on your server and upload with it in the browser, so the API key never leaves your server.

```ts
// Server
const { token } = await blob.uploadTokens.create({
  prefix: "avatars/",
  security_hash: true, // Required unless the token fixes `name`
  max_size: 5 * 1024 * 1024,
  allowed_extensions: ["png", "jpg"],
})

// Browser
const upload = new SquareCloudBlob(token)
const { url } = await upload.put(input.files[0], { name: "avatar" })
```

An upload token can only upload; every other method fails with `UPLOAD_TOKEN_NOT_ALLOWED`.

### Listing

```ts
// Every object, following the cursor (order is not guaranteed)
for await (const object of blob.list({ prefix: "avatars/" })) {
  console.log(object.id, object.url)
}

// A single page, with folders
const { objects, folders, continuationToken } = await blob.listPage({ delimiter: "/" })
```

Filters: `prefix`, `delimiter: "/"`, `private` and `limit` (1-1000).

### Object details and download links

```ts
const info = await blob.info(id) // Size, content type, headers, metadata, expiration

const { url, expires_at } = await blob.downloadUrl(id, { expires: 3600 })
```

Public objects get their permanent CDN URL. Private objects, or calls with `disposition`/`filename`, get a temporary link (max 24 h) that **cannot be revoked**. For revocable, password-protected or download-capped links, use shares.

### Updating objects

Changes the visibility, expiration, cache, disposition or metadata of up to 50 objects. Each result reports its own success:

```ts
const [result] = await blob.update(id, { private: true, expire: null })

if (result.ok) id = result.id // The id changed!
else console.log(result.code)
```

### Copying, moving and renaming

```ts
await blob.copy(id, { name: "photo_copy", prefix: "backup" }) // Counts toward your quota
await blob.move(id, { name: "renamed" })                     // Doesn't
```

`name` has no extension: the destination keeps the source's.

### Deleting

Deletion is immediate and permanent (there is no trash).

```ts
await blob.delete(id) // Throws OBJECT_NOT_FOUND if missing

const { deleted, not_found, failed } = await blob.delete([id1, id2]) // Up to 100
```

### Shares

```ts
const share = await blob.shares.create(id, {
  expires_in: 86400,     // Seconds
  max_downloads: 10,
  password: "secret123", // Pro/Enterprise
})

const shares = await blob.shares.list()
await blob.shares.revoke(share.id)
```

> [!WARNING]
> If `share.object_is_public` is `true`, the link redirects to the object's permanent public URL: the password, download cap and expiration **do not protect the file**. Make the object private first with `blob.update(id, { private: true })`.

### Rules

Per-prefix defaults and limits for the REST API. `set()` replaces the whole list.

```ts
const rules = await blob.rules.get()

await blob.rules.set([
  { prefix: "tmp/", delete_after_days: 7 }, // Deletion starts 24 h after saving
  { prefix: "avatars/", max_size: 5 * 1024 * 1024, extensions: ["png", "jpg"] },
])
```

### S3

The S3-compatible gateway works with any S3 client. With `@aws-sdk/client-s3` installed, `blob.s3()` returns a ready client:

```ts
import { ListObjectsV2Command } from "@aws-sdk/client-s3"

const s3 = await blob.s3()
await s3.send(new ListObjectsV2Command({ Bucket: "public" })) // Buckets: public, private, legacy
```

For other clients, `blob.s3Credentials()` returns the endpoint, region and key pair (API keys only; path-style addressing, region `auto`). The pair is fetched once per client instance.

### Account stats

```ts
const stats = await blob.stats()

console.log(stats.usage.objects) // Total objects
console.log(stats.usage.storage) // Storage used, in bytes
```

`billing` is only an estimate of the usage above your plan and is never charged.

### Handling errors

API errors throw `SquareCloudBlobError` with the HTTP `status`, the API `code` and any `extra` fields (e.g. `prefix` on rule errors):

```ts
import { SquareCloudBlobError } from "@squarecloud/blob"

try {
  await blob.shares.create(id, { password: "secret123" })
} catch (error) {
  if (error instanceof SquareCloudBlobError && error.isUpgradeRequired()) {
    // Your plan doesn't include this feature or limit (see error.message)
  }
}
```

Requests are retried automatically with exponential backoff on 429, 500, 503 and network errors, never on other 4xx. Change the number of retries with `new SquareCloudBlob(key, { maxRetries: 0 })` (default 5).

### Rate limits

Per account:

| Operation | Limit |
| --- | --- |
| Simple upload | 1/s (no limit on Pro and Enterprise) |
| List | 30 per 30 s |
| Info | 60/min |
| Download link | 60/min |
| Delete | 1000 objects per 10 s |
| Update | 50 objects per 10 s |
| Copy/move | 10 per 10 s |
| Rules (set) | 10/min |
| Stats | 20/min |
| Upload tokens (create) | 120/min |
| Shares | 30/min to create, 20/min to list |
| S3 credentials | 10/h |
| Chunked uploads | 5 per 10 s to open and to complete, 60 parts per 10 s |
| S3 gateway (per 10 s) | Hobby 100, Standard 200, Pro 400, Enterprise 600 |

## Contributing

Feel free to contribute with suggestions or bug reports at our [GitHub repository](https://github.com/squarecloudofc/sdk-blob-js).

## Authors

- [@joaotonaco](https://github.com/joaotonaco)
- [@JoaoOtavioS](https://github.com/JoaoOtavioS)
