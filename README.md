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

- It has **zero runtime dependencies** and weighs about 9 KB (3 KB gzipped), as ESM and CommonJS. `@aws-sdk/client-s3` is an optional peer that only `s3()` loads, so bundlers such as webpack, esbuild, Vite and Metro build without it.
- It runs on **Node.js 20+ and in browsers**, since it only needs `fetch`, `FormData` and `Blob`. File paths need Node.js, so a browser uploads with an [upload token](#uploading-from-the-browser).
- It covers **every Blob Storage endpoint** plus the **S3 gateway**.
- Files above 90 MiB are uploaded in **parallel parts**, up to 10 GiB, and file paths are streamed from disk.
- Every refusal from Blob Storage throws **one error type**, `SquareCloudBlobError`.

[Documentation](https://docs.squarecloud.app/en/blob-reference/authentication) · [Releases](https://github.com/squarecloudofc/sdk-blob-js/releases)

## Installation

```bash
npm install @squarecloud/blob
yarn add @squarecloud/blob
pnpm add @squarecloud/blob
bun add @squarecloud/blob
```

The SDK requires Node.js 20 or newer. To use `s3()`, also install `@aws-sdk/client-s3`.

## API key

Create an API key in the [Square Cloud dashboard](https://squarecloud.app/account/security). Blob Storage reads two scopes. `blob:read` covers listing, object details, download links, stats, rules and the share list, and `blob:write` covers everything that writes. A key without the scope a call needs gets `403 MISSING_SCOPE`, and a key restricted to specific applications gets `403 RESOURCE_NOT_ALLOWED`.

A key restricted to prefixes gets `403 PREFIX_NOT_ALLOWED` for any object outside them, and always from `stats()` and `rules.set()`. Uploading, copying, moving, creating temporary download links, saving rules and minting upload tokens need an active plan, and fail with `401 PERMISSION_DENIED` without one. Without an active plan, `update()` can still make objects private, and it reports `PERMISSION_DENIED` on each item for any other change.

Never ship the API key to a browser. Mint a short-lived **upload token** (`squp_...`) on your server instead. An upload token can only upload, and every other method fails with `403 UPLOAD_TOKEN_NOT_ALLOWED`. See [Uploading from the browser](#uploading-from-the-browser). Minting a token can fail with `403 PREFIX_NOT_ALLOWED` when a prefix-restricted key asks for a prefix outside its own, with `403 PERMISSION_DENIED` when the credential cannot mint tokens, and with `403 UPGRADE_REQUIRED` for an option your plan lacks.

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

CommonJS works too, with `const { SquareCloudBlob } = require("@squarecloud/blob");`.

## Configuration

```js
new SquareCloudBlob(credential, { maxRetries: 2 });
```

| Option | Default | Notes |
|---|---|---|
| `credential` (1st argument) | required | An API key, or an upload token that can only call `put()`. |
| `maxRetries` | `2` | How many times a failed read or chunked part is sent again. Only network errors and `5xx` are retried, and never a `429` except `TOO_MANY_CONCURRENT_CHUNKS` on a part. `0` turns retries off. See [Retries, timeouts and rate limits](#retries-timeouts-and-rate-limits). |

The SDK sends every call to `https://blob.squarecloud.app` with the global `fetch`, so a browser page with a Content Security Policy must allow that origin in `connect-src`. Options and results use the API's own field names. Most are snake_case, such as `security_hash`, `expires_at` and `max_downloads`, and a few are not, such as `continuationToken`. The [API reference](https://docs.squarecloud.app/en/blob-reference/authentication) therefore applies as it is.

## API

| Group | Methods |
|---|---|
| `blob` | `put(file, options)`, `list(options)` (async iterator), `listPage(options)`, `info(id)`, `downloadUrl(id, options)`, `update(ids, changes)`, `copy(source, destination, { overwrite, move })`, `move(source, destination, { overwrite })`, `delete(ids)`, `stats()`, `s3Credentials()`, `s3()` |
| `blob.shares` | `create(object, options)`, `list()`, `revoke(id)` |
| `blob.rules` | `get()`, `set(rules)` |
| `blob.uploadTokens` | `create(options)` |

Every method returns plain data, except `s3()`, which returns an `S3Client`. The package also exports `SquareCloudBlobError`, the `BlobErrorCode` union, and the option and result types, such as `PutOptions`, `PutResult`, `ListedObject`, `ObjectInfo`, `Share` and `Rule`.

## Usage

### Object ids

An object's `id`, such as `pub/<owner>/avatars/photo.png`, is opaque. Store it as returned, and never build or parse it. **Making an object public or private, or changing its expiration, changes its id**, so always replace your stored id with the one a call returns. Use the `url` of a response instead of building URLs. A private object has `url: null`, and [`downloadUrl()`](#object-details-and-download-links) gives you a link to it.

### Uploading

```js
const { id, url } = await blob.put("path/to/photo.png", {
  name: "photo", // without extension: ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$
  prefix: "avatars", // optional, up to 8 segments
  private: false, // a private object always gets a security hash
  security_hash: true, // appends _<hash> to the name
  expire: "30d", // "30", "30d" or "168h", from 7 to 1825 days
  overwrite: false, // fails with OBJECT_ALREADY_EXISTS if the name is taken
});
```

`put()` takes a file path in Node.js, a `Blob` or `File`, or bytes as a `Uint8Array`, `Buffer` or `ArrayBuffer`. A path is opened with `fs.openAsBlob` and streamed from disk, never read into memory. The extension comes from `filename`, then from the path's basename or the `File`'s name. Bytes and a plain `Blob` have no name, so pass `filename`, such as `"data.json"`, when you upload them. `mime_type` only picks the extension when the file name has none. The service derives the Content-Type from the extension, and it serves `html`, `svg` and `xml` as `application/octet-stream`.

The other options are `disposition`, `auto_download`, `cache_control`, `metadata` and `checksum_sha256`. `metadata` needs a Pro or Enterprise plan and takes up to 5 keys. With `checksum_sha256`, a file that does not match fails with `CHECKSUM_MISMATCH`, and nothing is stored. When `private`, `expire` or `cache_control` is omitted, the [rule](#rules) for the prefix decides.

A file must be at least 512 bytes. A file above exactly 90 MiB goes through a chunked upload automatically. The SDK sends it in 16 MiB parts, 6 at a time, up to 10 GiB, and a rule, an upload token's `max_size` or your storage quota can lower that limit. If the chunked upload fails, the parts in flight finish and the SDK aborts the upload. An account can have at most 32 chunked uploads open at once. A chunked upload does not check `checksum_sha256`.

A chunked upload respects `overwrite: false`. Right after it opens the upload, the SDK checks the name with `info()`, which costs one request from the account's [rate limit](#retries-timeouts-and-rate-limits). If the object exists, the SDK aborts the upload before sending any part and throws `409 OBJECT_ALREADY_EXISTS`. If `info()` gets a `429`, the SDK aborts the upload and throws that `429`, instead of sending parts that the service would refuse to complete. The service checks again when the upload completes, because the object may have appeared in the meantime. On that `409`, the SDK aborts the upload too, which frees its slot and discards the parts. The early check needs `blob:read`, and without it, or on any other `info()` failure, only the check at completion applies. There is no early check when the name cannot be taken, because `private: true` and `security_hash: true` add a random hash to it, and there is none with an upload token.

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

The token fixes every option it was minted with. It alone decides whether its upload can replace an object, and only a token with a fixed `name` and `security_hash: false` can, so `overwrite` has no effect with a token. A token lives `expires_in` seconds, from 60 to 3600 with a default of 900, and allows `max_uses` uploads, from 1 to 100 with a default of 1. After its last use it fails with `UPLOAD_TOKEN_USED`. Chunked uploads work with a token too. Revoking or regenerating the API key that minted a token stops the token.

### Listing

```js
// Every object, following the cursor (the order is not guaranteed)
for await (const object of blob.list({ prefix: "avatars/" })) {
  console.log(object.id, object.url);
}

// A single page, with folders
const { objects, folders, continuationToken } = await blob.listPage({
  delimiter: "/",
});
```

The filters are `prefix`, `delimiter: "/"`, which adds `folders`, `private`, and `limit`, from 1 to 1000 with a default of 1000. `listPage()` also takes `cursor`. Pass the previous page's `continuationToken`, which is absent on the last page. An API key restricted to several prefixes must pass one of them as `prefix`, or the listing fails with `400 PREFIX_REQUIRED`.

### Object details and download links

```js
const info = await blob.info(id); // size, content type, headers, metadata, expiration

const { url, expires_at } = await blob.downloadUrl(id, { expires: 3600 });
```

A public object returns its permanent URL on the global edge CDN, with `expires_at: null`. A private object, or a call with `disposition` or `filename`, returns a temporary link that lives `expires` seconds, from 60 to 86400 with a default of 3600. Creating a temporary link needs an active plan, and fails with `401 PERMISSION_DENIED` without one. A temporary link cannot be revoked on its own. It stops working early when the API key that created it is revoked, regenerated or expires, when the session that created it logs out, and when the object is overwritten, moved, deleted, or made public or private. For links that you can revoke one by one, protect with a password or cap by downloads, use [shares](#shares).

### Updating objects

`update()` changes the visibility, expiration, cache, disposition or metadata of one object or of up to 50. The result is always an array, and each item reports its own success:

```js
const [result] = await blob.update(id, { private: true, expire: null });

if (result.ok) {
  id = result.id; // the id changed
} else {
  console.log(result.code);
}
```

`null` removes a setting. For `metadata`, `{ key: null }` removes one key, and `null` removes all of them. Making a private object public also needs `blob:read`.

### Copying, moving and renaming

```js
await blob.copy(id, { name: "photo_copy", prefix: "backup" }); // counts toward your quota
await blob.move(id, { name: "renamed" }); // does not
```

`name` has no extension, because the destination keeps the source's. The destination also takes `prefix`, `private`, `security_hash` and `expire`. Without `prefix`, the object lands at the root, not in the source's folder. Without `expire`, it keeps the source's expiration, and `null` removes it. Pass `{ overwrite: true }` to replace an existing object. `copy()` also takes `{ move: true }`, which is what `move()` sends.

Copying needs `blob:read` on the source as well as `blob:write`, and fails with `403 MISSING_SCOPE` otherwise. A key restricted to prefixes needs both the source and the destination inside them, or it gets `403 PREFIX_NOT_ALLOWED`. The rules of the destination prefix, such as `extensions` and `max_size`, apply as they do to an upload.

### Deleting

Deletion is immediate and permanent. There is no trash.

```js
await blob.delete(id); // throws OBJECT_NOT_FOUND if missing

const { deleted, not_found, failed } = await blob.delete([id1, id2]); // up to 100
```

An array never throws for a missing object. It reports the id in `not_found` instead.

### Shares

```js
const share = await blob.shares.create(id, {
  expires_in: 86400, // seconds, from 60 to 2592000 (default 86400)
  max_downloads: 10, // from 1 to 10000
  password: "secret123", // 8 to 128 characters, Pro and Enterprise
});

const shares = await blob.shares.list();
await blob.shares.revoke(share.id);
```

> [!WARNING]
> If `share.object_is_public` is `true`, the link redirects to the object's permanent public URL, so the password, download cap and expiration **do not protect the file**. Make the object private first with `blob.update(id, { private: true })`.

A share link stops working when its object is moved, deleted, overwritten, or made public or private. An account can have up to 1000 active share links.

### Rules

A rule sets defaults and limits for one prefix, with `private`, `expire`, `max_size`, `extensions`, `cache_control` and `delete_after_days`. `set()` replaces the whole list and returns it. Plans allow up to 5 rules, Pro allows 10 and Enterprise allows 20.

```js
const rules = await blob.rules.get();

await blob.rules.set([
  { prefix: "tmp/", delete_after_days: 7 }, // deletion starts 24 h after saving
  { prefix: "avatars/", max_size: 5 * 1024 * 1024, extensions: ["png", "jpg"] },
]);
```

### S3

The S3-compatible gateway works with any S3 client. With `@aws-sdk/client-s3` installed, `blob.s3()` returns a ready client. Use it on a server only, because the S3 key pair comes from an API key, which never goes to a browser.

```js
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

const s3 = await blob.s3();
await s3.send(new ListObjectsV2Command({ Bucket: "public" }));
```

The gateway has two buckets, `public` and `private`. To set up another client, call `blob.s3Credentials()`. It returns the key pair, the `endpoint`, which is `https://s3-blob.squarecloud.app`, the `region`, which is `auto`, the buckets, and what the pair can access. Configure the client with path-style addressing. The pair needs an API key, so an upload token gets `UPLOAD_TOKEN_NOT_ALLOWED`. The SDK fetches the pair once per client, and the pair stops working when the API key is revoked or regenerated. A `PutObject` of up to 100 MiB is stored as one object, so its `ETag` is the MD5 of the content.

### Account stats

```js
const stats = await blob.stats();

console.log(stats.usage.objects); // total objects
console.log(stats.usage.storage); // storage used, in bytes
```

The service caches stats for up to 60 seconds. `billing` is only an estimate of the usage above your plan, and it is not charged. A key restricted to prefixes gets `403 PREFIX_NOT_ALLOWED`, because stats need a key for the whole account.

## Errors

Every refusal from Blob Storage throws a `SquareCloudBlobError` with these fields:

- `status` is the HTTP status.
- `code` is the error code, such as `OBJECT_NOT_FOUND` or `RATE_LIMITED`, typed as `BlobErrorCode`.
- `message` is the service's explanation. When the service sends none, it is the code.
- `extra` holds any other fields of the error body, such as `prefix` on a rule error.
- `isUpgradeRequired()` returns `true` for `UPGRADE_REQUIRED`, the code of every plan refusal. The message says which limit or feature your plan lacks.

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

- A response without an error code, such as an error page from a proxy or any other non-JSON body, throws `UNKNOWN_ERROR` with the real `status` and a message that explains it. A `2xx` without `status: "success"` also throws.
- A request that gets no complete response is **not** wrapped. A DNS failure, a reset connection or a body cut off mid-read throws the `fetch` error itself, after the retries on reads and chunked parts.
- In Node.js, an upload path that cannot be opened throws a plain `Error` that names the path, with the original error in `cause`. Outside Node.js, any path throws a plain `Error` that asks for a `Blob`, a `File` or bytes instead.
- When `@aws-sdk/client-s3` cannot be loaded, `s3()` throws a plain `Error` that says how to install it.
- A batch `update()` or `delete()` reports per-object failures in its result instead of throwing.

## Retries, timeouts and rate limits

- **Retries:** the SDK only retries what is safe to repeat. Network errors and `5xx` are retried on reads (list, info, download links, stats, rules, the share list and S3 credentials) and on chunked upload parts, because each part number can be sent again. A call is retried up to `maxRetries` times, 2 by default, with exponential backoff. The wait is `min(8 s, 500 ms·2ⁿ)`, and jitter keeps 50 to 100 % of it. The API sends no `Retry-After`. Every other call gets one attempt, including simple uploads, starting and completing a chunked upload, `update()`, `copy()`, `move()`, `delete()`, `rules.set()`, token and share creation, and share revocation. A `429` is never retried, and neither is any other `4xx`. The one exception is `TOO_MANY_CONCURRENT_CHUNKS` on a chunked part. The service refuses the part before reading it, so the SDK sends the part again within the same budget, and the refusal still counts toward the limit of 60 parts per 10 seconds. The SDK sends 6 parts at a time, which is the service's limit for parts in flight, so run one large upload at a time per account.
- **Storage outages:** `503 STORAGE_UNAVAILABLE` means storage is briefly unreachable, and the service refuses object calls in windows of about 10 seconds. Reads and chunked parts retry it within `maxRetries`, which may not outlast the window, since the default 2 retries take under 2 seconds. Other calls get one attempt. When it still fails, try again after about 10 seconds. A chunked upload refused this way when it completes is aborted like any other failure, so run the whole `put()` again after about 10 seconds.
- **Timeouts:** there is no client timeout and no way to cancel a call. A request lasts as long as `fetch` waits.
- **Rate limits:** every call with an API key also counts against the account-wide limit shared with `api.squarecloud.app`. That limit depends on the plan, from 5 calls a minute without a plan to 30 on the smallest paid plan. Going over it is `429 RATE_LIMITED` and blocks the account for 30 minutes. More than 30 failed credentials in a minute block the IP for 5 minutes with the same code, valid keys included. The old `RATE_LIMIT` code is no longer sent and stays in `BlobErrorCode` as deprecated. Chunked upload parts skip the account-wide limit. An upload token has its own limit of 60 requests a minute, and going over it blocks the token for 5 minutes. On top of that, each operation has its own limit per account, and going over it is `429 RATE_LIMITED` for one full window:

| Operation | Limit |
|---|---|
| Upload up to 90 MiB | 1/s (no limit on Pro and Enterprise) |
| Chunked upload | 5 per 10 s to start and to complete, 60 parts per 10 s, 10 aborts per 10 s |
| List | 30 per 30 s |
| Info | 60/min |
| Download link | 60/min |
| Update | 50 objects per 10 s |
| Copy and move | 10 per 10 s |
| Delete | 1000 objects per 10 s |
| Rules (set) | 10/min |
| Stats | 20/min |
| Upload tokens (create) | 120/min |
| Shares | 30/min to create, 20/min to list |
| S3 credentials | 10/h |
| S3 gateway (per 10 s) | Hobby 100, Standard 200, Pro 400, Enterprise 600, plus 20 copies and 2000 deleted keys |
| S3 gateway transfers | About 64 downloads and 64 uploads at a time per server, or 256 each on Enterprise. Past that, `SlowDown`. |
| Temporary download links (visitors) | 60/min per IP, and 300/min across all of an account's links (1200 on Enterprise). About 64 downloads at a time per server, or 256 on Enterprise. |
| Share links (visitors) | 300/min per link to a public object, 60/min per link to a private one |

A link past its limit answers a plain `429` page, not a JSON error.

## Development

```bash
pnpm install
pnpm lint    # biome check --write .
pnpm test    # offline: fetch is stubbed, no API key needed
pnpm build   # lib/ (ESM + CJS + d.ts)
```

The tests run the TypeScript sources directly, so they need a Node.js version with type stripping, which is 22.18 or newer. The live suite runs a round trip against the real API and reads the key from `.env`:

```bash
echo "SQUARECLOUD_API_KEY=..." > .env
pnpm test:live   # node --env-file=.env test/live.test.ts
```

> **Warning:** the live suite uploads, reads and deletes a real object (`sdk-test/sdk_live_test_<hash>.txt`) on the key's account, which needs an active plan. It fails without `.env`, and it never runs in CI.

## Contributing

Issues and pull requests are welcome at [squarecloudofc/sdk-blob-js](https://github.com/squarecloudofc/sdk-blob-js).

## License

MIT, see [LICENSE](LICENSE).

## Authors

Maintained by [Square Cloud](https://squarecloud.app).

Contributors:

- João Otávio Stivi ([@JoaoOtavioS](https://github.com/JoaoOtavioS))
- João Gabriel Tonaco ([@joaotonaco](https://github.com/joaotonaco))
