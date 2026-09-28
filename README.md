<div align="center">
  <img alt="Square Cloud Banner" src="https://cdn.squarecloud.app/png/github-readme.png">
</div>

<h1 align="center">@squarecloud/blob</h1>

<p align="center">The official JavaScript SDK for the <a href="https://squarecloud.app" target="_blank">Square Cloud</a> Blob Storage.</p>

<div align="center">
  <a href="https://www.npmjs.com/package/@squarecloud/blob"><img alt="npm Version" src="https://img.shields.io/npm/v/@squarecloud/blob"></a>
  <img alt="License" src="https://img.shields.io/npm/l/@squarecloud/blob">
  <img alt="Downloads" src="https://img.shields.io/npm/dw/@squarecloud/blob">
</div>

- **Zero runtime dependencies**, ~10 KB (4 KB gzipped), ESM + CommonJS. `@aws-sdk/client-s3` is an optional peer, loaded only by `s3()`.
- Runs on **Node.js 20+ and in browsers**: only `fetch`, `FormData` and `Blob`. File paths need Node.js; in a browser, use an [upload token](#uploading-from-the-browser).
- Covers **every Blob Storage endpoint** plus the **S3 gateway**.
- Files above ~90 MB are uploaded in **parallel parts**, up to 10 GiB, and paths are streamed from disk.
- **One error type**, `SquareCloudBlobError`, for every API failure.

[Documentation](https://docs.squarecloud.app/en/blob-reference/authentication) · [Releases](https://github.com/squarecloudofc/sdk-blob-js/releases)

## Installation

```bash
npm install @squarecloud/blob
yarn add @squarecloud/blob
pnpm add @squarecloud/blob
bun add @squarecloud/blob
```

Requires Node.js 20 or newer. For `s3()`, also install `@aws-sdk/client-s3`.

## API key

Create one in the [Square Cloud dashboard](https://squarecloud.app/account/security). Blob Storage reads two scopes: `blob:read` (list, info, download links, stats, rules, share list) and `blob:write` (everything that writes). A key without the needed scope gets `403 MISSING_SCOPE`, and a key restricted to specific applications gets `403 RESOURCE_NOT_ALLOWED`. Uploading, copying, moving, saving rules and minting upload tokens need an active plan (`401 PERMISSION_DENIED` otherwise). Without one, `update()` reports `PERMISSION_DENIED` on each item that makes an object public or sets an expiration.

Never ship the API key to a browser. Mint a short-lived **upload token** (`squp_...`) on your server instead: it can only upload, and every other method fails with `403 UPLOAD_TOKEN_NOT_ALLOWED`. See [Uploading from the browser](#uploading-from-the-browser).

## Quick start

```js
import { SquareCloudBlob } from "@squarecloud/blob";

const blob = new SquareCloudBlob(process.env.SQUARECLOUD_API_KEY);

const { id, url } = await blob.put("./photo.png", {
  name: "photo",
  prefix: "avatars",
});
console.log(id, url);

for await (const object of blob.list({ prefix: "avatars/" })) {
  console.log(object.id, object.size);
}
```

CommonJS works too: `const { SquareCloudBlob } = require("@squarecloud/blob");`.

## Configuration

```js
new SquareCloudBlob(credential, { maxRetries: 2 });
```

| Option | Default | Notes |
|---|---|---|
| `credential` (1st argument) | required | An API key, or an upload token that can only call `put()`. Sent raw in `Authorization`. |
| `maxRetries` | `2` | Retries network errors and 5xx on reads and chunked parts only, never a 429 (except `TOO_MANY_CONCURRENT_CHUNKS` on a part). `0` disables them. See [Retries, timeouts and rate limits](#retries-timeouts-and-rate-limits). |

The base URL (`https://blob.squarecloud.app`) is fixed and requests use the global `fetch`. Options and results use the API's own field names, which are snake_case (`security_hash`, `expires_at`, `max_downloads`...) except for a few such as `continuationToken`, so the [API reference](https://docs.squarecloud.app/en/blob-reference/authentication) applies as-is.

## API

| Group | Methods |
|---|---|
| `blob` | `put(file, options)`, `list(options)` (async iterator), `listPage(options)`, `info(id)`, `downloadUrl(id, options)`, `update(ids, changes)`, `copy(source, destination, { overwrite })`, `move(source, destination, { overwrite })`, `delete(ids)`, `stats()`, `s3Credentials()`, `s3()` |
| `blob.shares` | `create(object, options)`, `list()`, `revoke(id)` |
| `blob.rules` | `get()`, `set(rules)` |
| `blob.uploadTokens` | `create(options)` |

Every method except `s3()` (which returns an `S3Client`) returns plain data (no classes). The package also exports `SquareCloudBlobError`, the `BlobErrorCode` union and the option and result types (`PutOptions`, `PutResult`, `ListedObject`, `ObjectInfo`, `Share`, `Rule`, ...).

## Usage

### Object ids

An object's `id` (e.g. `pub/<owner>/avatars/photo.png`) is opaque: store it as returned and never build or parse it. **Making an object public or private, or changing its expiration, changes its id**, so always replace your stored id with the one returned. Use the `url` of a response instead of building URLs; private objects have `url: null` (see [`downloadUrl()`](#object-details-and-download-links)).

### Uploading

```js
const { id, url } = await blob.put("path/to/photo.png", {
  name: "photo", // without extension: ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$
  prefix: "avatars", // optional, up to 8 segments
  private: false, // private objects always get a security hash
  security_hash: true, // appends _<hash> to the name
  expire: "30d", // "30", "30d" or "168h"; 7d to 1825d
  overwrite: false, // fails with OBJECT_ALREADY_EXISTS if the name is taken (simple uploads only)
});
```

`put()` takes a file path (Node.js), a `Blob`/`File`, or bytes (`Uint8Array`, `Buffer`, `ArrayBuffer`). A path is opened with `fs.openAsBlob` and streamed from disk, never read into memory. The extension comes from `filename`, then the path's basename or the `File`'s name, so pass `filename` (e.g. `"data.json"`) when uploading bytes or a plain `Blob`. `mime_type` only picks the extension when the file name has none. The server derives the Content-Type, and serves `html`, `svg` and `xml` as `application/octet-stream`.

Other options: `disposition`, `auto_download`, `cache_control`, `metadata` (Pro and Enterprise, up to 5 keys) and `checksum_sha256` (a mismatch fails with `CHECKSUM_MISMATCH` and stores nothing).

Files must be at least 512 B. Files above ~90 MB go through a chunked upload automatically: parts of at least 16 MiB, 6 in parallel, up to 10 GiB (a rule or upload token `max_size`, or your storage quota, can lower it). If a part fails for good, the parts in flight finish and the upload is aborted. At most 32 chunked uploads can be open per account. A chunked upload does not check `overwrite: false` or `checksum_sha256`: it always replaces an object with the same name.

### Uploading from the browser

Mint a token on your server and upload with it in the browser, so the API key never leaves your server.

```js
// Server
const { token } = await blob.uploadTokens.create({
  prefix: "avatars/",
  security_hash: true, // always on unless the token fixes `name`
  max_size: 5 * 1024 * 1024,
  allowed_extensions: ["png", "jpg"],
});

// Browser
const upload = new SquareCloudBlob(token);
const { url } = await upload.put(input.files[0], { name: "avatar" });
```

The token pins every option it was minted with. It lives `expires_in` seconds (60 to 3600, default 900) and allows `max_uses` uploads (1 to 100, default 1), then fails with `UPLOAD_TOKEN_USED`. Chunked uploads work with a token too.

### Listing

```js
// Every object, following the cursor (order is not guaranteed)
for await (const object of blob.list({ prefix: "avatars/" })) {
  console.log(object.id, object.url);
}

// A single page, with folders
const { objects, folders, continuationToken } = await blob.listPage({
  delimiter: "/",
});
```

Filters: `prefix`, `delimiter: "/"` (adds `folders`), `private` and `limit` (1 to 1000, default 1000). `listPage()` also takes `cursor`: pass the previous page's `continuationToken`, which is absent on the last page.

### Object details and download links

```js
const info = await blob.info(id); // size, content type, headers, metadata, expiration

const { url, expires_at } = await blob.downloadUrl(id, { expires: 3600 });
```

Public objects get their permanent CDN URL (`expires_at: null`). Private objects, or calls with `disposition` or `filename`, get a temporary link that lives `expires` seconds (60 to 86400, default 3600) and **cannot be revoked**. For revocable, password-protected or download-capped links, use [shares](#shares).

### Updating objects

Changes the visibility, expiration, cache, disposition or metadata of one object or up to 50. The result is always an array, and each item reports its own success:

```js
const [result] = await blob.update(id, { private: true, expire: null });

if (result.ok) {
  id = result.id; // the id changed
} else {
  console.log(result.code);
}
```

`null` removes a setting. For `metadata`, `{ key: null }` removes one key and `null` removes all.

### Copying, moving and renaming

```js
await blob.copy(id, { name: "photo_copy", prefix: "backup" }); // counts toward your quota
await blob.move(id, { name: "renamed" }); // does not
```

`name` has no extension: the destination keeps the source's. The destination also takes `private`, `security_hash` and `expire` (omitted keeps the source's expiration, `null` removes it). Pass `{ overwrite: true }` to replace an existing object.

### Deleting

Deletion is immediate and permanent (there is no trash).

```js
await blob.delete(id); // throws OBJECT_NOT_FOUND if missing

const { deleted, not_found, failed } = await blob.delete([id1, id2]); // up to 100
```

An array never throws for a missing object: it reports it in `not_found`.

### Shares

```js
const share = await blob.shares.create(id, {
  expires_in: 86400, // seconds, 60 to 2592000 (default 86400)
  max_downloads: 10, // 1 to 10000
  password: "secret123", // 8 to 128 chars, Pro and Enterprise
});

const shares = await blob.shares.list();
await blob.shares.revoke(share.id);
```

> [!WARNING]
> If `share.object_is_public` is `true`, the link redirects to the object's permanent public URL: the password, download cap and expiration **do not protect the file**. Make the object private first with `blob.update(id, { private: true })`.

### Rules

Per-prefix defaults and limits: `private`, `expire`, `max_size`, `extensions`, `cache_control` and `delete_after_days`. `set()` replaces the whole list and returns it.

```js
const rules = await blob.rules.get();

await blob.rules.set([
  { prefix: "tmp/", delete_after_days: 7 }, // deletion starts 24 h after saving
  { prefix: "avatars/", max_size: 5 * 1024 * 1024, extensions: ["png", "jpg"] },
]);
```

### S3

The S3-compatible gateway works with any S3 client. With `@aws-sdk/client-s3` installed, `blob.s3()` returns a ready client:

```js
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

const s3 = await blob.s3();
await s3.send(new ListObjectsV2Command({ Bucket: "public" }));
```

Buckets: `public`, `private` and `legacy` (read, list and delete only). For other clients, `blob.s3Credentials()` returns the `endpoint`, `region` (`auto`), key pair, buckets and access; use path-style addressing. The pair needs an API key (`UPLOAD_TOKEN_NOT_ALLOWED` for an upload token, `LEGACY_API_KEY` for an old key), is fetched once per client, and dies when the key is revoked or rotated.

### Account stats

```js
const stats = await blob.stats();

console.log(stats.usage.objects); // total objects
console.log(stats.usage.storage); // storage used, in bytes
```

The server caches stats for 60 s. `billing` is only an estimate of the usage above your plan and is never charged.

## Errors

Every API failure throws a `SquareCloudBlobError` with:

- `status`: the HTTP status.
- `code`: the API code (`OBJECT_NOT_FOUND`, `RATE_LIMITED`...), typed as `BlobErrorCode`.
- `message`: the server's explanation, or the code when there is none.
- `extra`: any other fields of the error body (e.g. `prefix` on rule errors).
- `isUpgradeRequired()`: `true` for `UPGRADE_REQUIRED`, the code of every plan refusal (the message says which limit or feature).

```js
import { SquareCloudBlobError } from "@squarecloud/blob";

try {
  await blob.shares.create(id, { password: "secret123" });
} catch (error) {
  if (error instanceof SquareCloudBlobError && error.isUpgradeRequired()) {
    console.error(error.message); // your plan lacks this feature or limit
  }
}
```

- A body without a code (a proxy error page, any non-JSON response) is `UNKNOWN_ERROR` with the real `status`. A `2xx` without `status: "success"` also throws.
- A request that gets no complete response (DNS, connection reset, a body cut off mid-read) is **not** wrapped: the `fetch` error itself is thrown (after the retries, on reads and chunked parts).
- An upload path that cannot be opened throws a plain `Error` (`Cannot open file: <path>`, original error in `cause`).
- A batch `update()` or `delete()` reports per-object failures in its result instead of throwing.

## Retries, timeouts and rate limits

- **Retries:** only what is safe to repeat. Network errors and `5xx` are retried on `GET` calls (list, info, download links, stats, rules, shares list, S3 credentials) and on chunked upload parts (each part number can be sent again), up to `maxRetries` (2) times with exponential backoff: `min(8 s, 500 ms·2ⁿ)` with jitter (50 to 100 % of it). The API sends no `Retry-After`. Every other call (simple uploads, starting and completing a chunked upload, update, copy, move, delete, `rules.set()`, token and share creation, share revocation) gets one attempt. A `429` is never retried, and neither is any other `4xx`. The one exception is `TOO_MANY_CONCURRENT_CHUNKS` on a chunked part: the server refuses the part before reading it, so the part is sent again within the same budget (the refusal still counts toward the 60 parts per 10 s). Parts go 6 at a time, the server's limit for parts in flight, so run one large upload at a time per account.
- **Timeouts:** there is no client timeout and no way to cancel a call. A request lasts as long as `fetch` waits.
- **Rate limits:** every API key call also counts against the account-wide budget shared with `api.squarecloud.app` (per plan, per minute: 5 without a plan, 30 on the smallest paid plan). Going over it is `429 RATE_LIMITED` and blocks the account for 30 minutes (more than 30 failed credentials in a minute block the IP, valid keys included, for 5 minutes, with the same code). The old `RATE_LIMIT` code is no longer sent and is kept in `BlobErrorCode` as deprecated. Chunked upload parts skip it, and an upload token has its own budget of 60 requests per minute (going over it blocks the token for 5 minutes). On top of that, each operation has its own per-account limit; going over it is `429 RATE_LIMITED` for one full window:

| Operation | Limit |
|---|---|
| Simple upload | 1/s (no limit on Pro and Enterprise) |
| Chunked upload | 5 per 10 s to start and to complete, 60 parts per 10 s, 10 aborts per 10 s |
| List | 30 per 30 s |
| Info | 60/min |
| Download link | 60/min |
| Update | 50 objects per 10 s |
| Copy/move | 10 per 10 s |
| Delete | 1000 objects per 10 s |
| Rules (set) | 10/min |
| Stats | 20/min |
| Upload tokens (create) | 120/min |
| Shares | 30/min to create, 20/min to list |
| S3 credentials | 10/h |
| S3 gateway (per 10 s) | Hobby 100, Standard 200, Pro 400, Enterprise 600; 20 copies and 2000 deleted keys |

## Development

```bash
pnpm install
pnpm lint    # biome check --write .
pnpm test    # offline: fetch is stubbed, no API key needed
pnpm build   # lib/ (ESM + CJS + d.ts)
```

The tests run the TypeScript sources directly, so they need a Node.js version with type stripping (22.18 or newer). The live suite runs a round trip against the real API. It reads the key from `.env`:

```bash
echo "SQUARECLOUD_API_KEY=..." > .env
pnpm test:live   # node --env-file=.env test/live.test.ts
```

> **Warning:** the live suite uploads, reads and deletes a real object (`sdk-test/sdk_live_test_<hash>.txt`) on the key's account, which needs an active plan. It fails without `.env`, and never runs in CI.

## Contributing

Issues and pull requests are welcome at [squarecloudofc/sdk-blob-js](https://github.com/squarecloudofc/sdk-blob-js).

## License

MIT, see [LICENSE](LICENSE).

## Authors

Maintained by [Square Cloud](https://squarecloud.app).

Contributors:

- João Otávio Stivi ([@JoaoOtavioS](https://github.com/JoaoOtavioS))
- João Gabriel Tonaco ([@joaotonaco](https://github.com/joaotonaco))
