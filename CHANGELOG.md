# @squarecloud/blob

## 4.2.0

### Minor Changes

- Chunked uploads respect `overwrite: false` before they send any part, `STORAGE_UNAVAILABLE` is a known code, and every public API is documented.
  
  **Changes**
  
  - `put()` of a file above 90 MiB with `overwrite: false` now checks the name with `info()` right after it opens the chunked upload. If the object exists, the SDK aborts the upload before sending any part and throws `409 OBJECT_ALREADY_EXISTS`. The check costs one request from the account's rate limit and needs `blob:read`. If it gets a `429`, the SDK aborts the upload before sending any part and throws that `429`. Any other failure, such as a missing `blob:read`, a `404` or a network error, lets the upload go on, and the service's own check at completion applies. There is no check with `private: true` or `security_hash: true`, because the name gets a random hash and cannot be taken. There is none with an upload token either, because the service ignores `overwrite` for token uploads and the token decides whether its upload can replace an object.
  - `STORAGE_UNAVAILABLE` is added to `BlobErrorCode`. It is the `503` the service answers while storage is briefly unreachable, when it refuses object calls in windows of about 10 seconds. Reads and chunked parts retry it within `maxRetries`, which may not outlast the window, since the default 2 retries take under 2 seconds. Other calls get one attempt. When it still fails, try again after about 10 seconds. A chunked upload refused this way when it completes is aborted, so run the whole `put()` again.
  - `LEGACY_API_KEY` is deprecated in `BlobErrorCode`. The service no longer sends it, and an old API key is refused with `401 ACCESS_DENIED`, like any unknown key. It stays in the union.
  - The errors the SDK creates itself now say what happened and how to fix it. Code that compares these messages must use the new text.
    - A path that cannot be opened in Node.js throws `Cannot open the file "<path>". Check that the path exists and that this process can read it.` It used to throw `Cannot open file: <path>`.
    - A path outside Node.js throws `File paths can only be uploaded in Node.js. Pass a Blob, a File or bytes instead.` It used to throw `File paths need Node.js`.
    - `s3()` without `@aws-sdk/client-s3` throws a message that says how to install it, or to pass `s3Credentials()` to another S3 client. It used to throw `s3() needs @aws-sdk/client-s3 installed`.
    - `UNKNOWN_ERROR`, for a response without an error code, has a message that names the HTTP status and the likely cause. Its message used to be the code itself.
    - The `409 OBJECT_ALREADY_EXISTS` of the early name check says that the upload was aborted before any part was sent, and how to replace the object.
  - Every public class, method, option, type and field has documentation that says what it does, what it takes, what it returns, which errors it throws and what to do about them. The documentation ships in the type declarations, so the JavaScript files stay about 9 KB (3 KB gzipped).
  
  **Fixes**
  
  - The README and the documentation said that a chunked upload ignores `overwrite: false` and always replaces the object. The service enforces it at completion with `409 OBJECT_ALREADY_EXISTS`. On that `409`, the SDK aborts the upload and throws it, which frees one of the 32 open-upload slots and discards the parts.
  - The README said that, without an active plan, `update()` reports `PERMISSION_DENIED` only when an item makes an object public or sets an expiration. Without a plan, only making objects private works, and every other change reports `PERMISSION_DENIED`.
  - `PutOptions.private` said the default is `false`. When it is omitted, the rule for the prefix decides, and without a rule the object is public. The same holds for `expire` and `cache_control`.
  - The documentation now says that `copy()` and `move()` without `destination.prefix` put the object at the root, not in the source's folder.
  - The README now says that the chunked upload starts above exactly 90 MiB and uses 16 MiB parts, while the service accepts up to 32 MiB. It also says that `copy()` takes `move`, and that `Cannot open the file` only happens in Node.js. A browser page with a Content Security Policy must allow `https://blob.squarecloud.app` in `connect-src`.
  - The README and the `downloadUrl()` documentation used to say that temporary download links cannot be revoked. They now say that these links need an active plan, and that they stop working when the API key that created them is revoked, regenerated or expires, when the session that created them logs out, and when the object is overwritten, moved, deleted, or made public or private.
  - The README documents the permission checks. `copy()` needs `blob:read` on the source, and a prefix-restricted key needs the destination inside its prefixes. `stats()` with a prefix-restricted key is `403 PREFIX_NOT_ALLOWED`. `uploadTokens.create()` can answer `403`. A listing with a key restricted to several prefixes needs a `prefix`, and making a private object public needs `blob:read`.
  - The README documents the limits on transfers in flight, about 64 at a time per server or 256 on Enterprise. It documents the limits of temporary download links and share links, 300 a minute per link to a public object and 60 to a private one, the rule count per plan, and the cap of 1000 active share links. It says that an S3 `PutObject` is stored as one object with an MD5 `ETag`, gives the S3 endpoint, and no longer lists `LEGACY_API_KEY` for `s3Credentials()`.

## 4.1.0

### Minor Changes

- The S3 gateway has two buckets, `public` and `private`.

  **Changes**

  - `OBJECT_IS_LEGACY` is deprecated in `BlobErrorCode`: the service no longer sends it, since headers change in place on every object. It stays in the union.
  - `ObjectInfo.legacy` is deprecated and optional: `info()` no longer returns it.
  - The README and the `s3()` JSDoc list the `public` and `private` buckets.

## 4.0.1

### Patch Changes

- Bundle for the browser without `@aws-sdk/client-s3`.
  
  **Fixes**
  
  - `put()` with a `File` or `Blob` no longer breaks the build in webpack (and Next.js), esbuild or Metro (Expo, React Native) when `@aws-sdk/client-s3` is not installed. The `import()` of `@aws-sdk/client-s3` in `s3()` and of `node:fs` for file paths are now hidden from the bundler (optional for Metro), so neither is resolved at build time. They load on demand, as before. Vite no longer warns about `node:fs`.
  - `s3()` without `@aws-sdk/client-s3` installed throws `s3() needs @aws-sdk/client-s3 installed` (with the original error as `cause`), and a file path outside Node.js throws `File paths need Node.js`.
  - The README and JSDoc say that `s3()` is Node.js only: its key pair needs an API key, which never goes to a browser.

## 4.0.0

### Major Changes

- Retry only what is safe to repeat.
  
  **Breaking changes**
  
  - A `429` is never retried. `RATE_LIMITED` is both the per-route window and the account/IP block, which can last 30 minutes, so the caller decides what to do. This includes the simple upload limit (1/s below Pro) and `TOO_MANY_CONCURRENT_UPLOADS`. The one exception is `TOO_MANY_CONCURRENT_CHUNKS` on a chunked part, which the server refuses before reading the part: the part is sent again within `maxRetries`.
  - Network errors and `5xx` are retried only on `GET` calls and on chunked upload parts (idempotent per part number), and now on any `5xx` (was only `500` and `503`). Simple uploads, starting, completing and aborting a chunked upload, `update()`, `copy()`, `move()`, `delete()`, `rules.set()`, `uploadTokens.create()`, `shares.create()` and `shares.revoke()` get one attempt.
  - `maxRetries` now defaults to `2` (was `5`), and the backoff is capped at 8 s (was 30 s): `min(8 s, 500 ms · 2^attempt) · U(0.5, 1.0)`.
  - `SavedRule.active_from` is optional: the API only sends it for rules with `delete_after_days`.
  - `delete([id])` with a single id now reports `PREFIX_NOT_ALLOWED` in `failed`, like any batch, instead of throwing.
  
  **Fixes**
  
  - A response body cut off mid-read is a network error: it is retried on `GET` calls and chunked parts, and otherwise the `fetch` error is thrown (it was `UNKNOWN_ERROR` with the response status).
  - A failed chunked upload waits for the parts still in flight before aborting, so no part lands after the abort and no request outlives `put()`.
  
  **Changes**
  
  - `RATE_LIMIT` is deprecated in `BlobErrorCode`: the service no longer sends it (the account/IP block is `RATE_LIMITED`). It stays in the union. `DUPLICATE_RULE_PREFIX` is added.
  - The README and JSDoc now say that a chunked upload (above ~90 MB) does not check `overwrite: false` or `checksum_sha256`, and correct the plan, scope and rate-limit details.
  
  **Migration**
  
  No method, option or export was renamed or removed. If you relied on the old retries:
  
  - Handle `429 RATE_LIMITED` yourself, and wait before trying again: the block can last 30 minutes.
  - Retry a write after a network error or a `5xx` only when repeating it is safe for you (for example, `put()` to the same name with `overwrite: true`).
  - Pass `{ maxRetries: 5 }` to keep more attempts on reads and chunked parts.
  - TypeScript: handle `active_from` being `undefined`.

## 3.0.0

### Major Changes

- Rewrite the SDK for the current Blob Storage API.
  
  **Breaking changes**
  
  - The client methods are flat: `blob.objects.create()` → `blob.put(file, options)`, `blob.objects.list()` → `blob.list()` (async iterator) or `blob.listPage()`, `blob.objects.delete()` → `blob.delete()`.
  - Options and results use the API's field names (`security_hash`, `auto_download`, `expire: "30d"`, `expires_at`), and results are plain objects: the `BlobObject` class is gone.
  - Object ids are opaque (`pub/...`, `prv/...`) and are no longer parsed; `delete()` no longer accepts a public URL. Use the `url` from each response.
  - Removed `MimeTypes`, `MimeTypeUtil` and client-side name/prefix/size validation: the server derives the Content-Type and validates everything. When uploading bytes, pass `filename` to set the extension.
  - `SquareCloudBlobError` now takes `(status, code, message, extra)`, and `SquareCloudValidationError` is gone. A missing file path throws a plain `Error`.
  
  **Features**
  
  - Private objects, `update()` (visibility, expiration, headers, metadata), `copy()`/`move()`, `info()` and `downloadUrl()`.
  - Automatic chunked uploads above ~90 MB, up to 10 GiB.
  - `uploadTokens.create()` for browser uploads, `shares`, `rules`, `s3Credentials()` and `s3()`.
  - Automatic retries with backoff on 429, 500, 503 and network errors (`maxRetries` option), and `error.isUpgradeRequired()`.

  **Tooling**

  - The build moved from tsup to tsdown: the files are now `lib/index.cjs` and `lib/index.mjs` (imports through the `exports` map are unaffected), and only `lib/` and the changelog are published.

## 2.0.2

### Patch Changes

- Audit documentation links (all verified live) and update the release workflow to current GitHub Actions versions (checkout v7, setup-node v6, pnpm/action-setup v6, Node 22).

## 2.0.1

### Patch Changes

- Improve README (document `blob.stats()`, fix install snippets, note Node.js 20+ requirement) and update authors/contributors.

## 2.0.0

### Major Changes

- Sync the SDK with the current Blob service contract.

  **Breaking changes**

  - `objects.list` now returns `{ objects, continuationToken }` instead of a plain array, exposing pagination via `continuationToken`.
  - Removed the unused `SquareCloudBlob.apiInfo` static (the API base URL now lives in `APIManager.baseUrl`).
  - Node.js 20+ is now required (Node 18 is end-of-life).
  - Added a package `exports` map: deep imports from `lib/` internals are no longer part of the public API.
  - The service renamed several error codes (dry cut, old codes are no longer emitted): `RATELIMIT` → `RATE_LIMITED`, `FAILED_DELETE` → `DELETE_FAILED`, `FAILED_LIST` → `LIST_FAILED`, `INVALID_FILETYPE` → `INVALID_FILE_TYPE`, `PAYLOAD_TOO_LARGE` → `FILE_TOO_LARGE`. The 401 for uploads without a paid plan is now `PERMISSION_DENIED` (`ACCESS_DENIED` remains auth-only).
  - Deleting an object that does not exist now throws `OBJECT_NOT_FOUND` (404) instead of succeeding silently.

  **Features**

  - `SquareCloudBlobError` now exposes the raw error code via `error.code` (typed as `BlobErrorCode`) and is exported from the package root.
  - Client-side validation on upload: object name/prefix pattern, expiration range (1-365 days), file size (1 KiB-100 MB) and MIME allowlist.
  - Uploads are queued so at most 4 run concurrently (the API limit) and are automatically retried with backoff on `TOO_MANY_CONCURRENT_UPLOADS`.
  - `objects.delete` accepts the object public URL and normalizes it to the object id.
  - `MimeTypeUtil.fromExtension("m4a")` now resolves to `audio/mp4`.

  **Fixes**

  - MIME type inference from file paths now uses the last extension segment (paths like `./file.png` previously broke it) and an explicit `mimeType` option now takes precedence.
  - API error responses with a `message` field now include it in the thrown error.

  **Docs**

  - `text/html` and `image/svg+xml` files are stored as `application/octet-stream`: their public URL downloads the file instead of rendering it inline (same for `autoDownload: true`).
  - Uploading requires a paid plan; listing is cached server-side for ~30 minutes.
  - Update documentation URLs.

  **Tooling**

  - Update all dev dependencies (Biome 2.5, Changesets 2.31, @types/node 26, tsx 4.23, TypeScript 6.0). TypeScript is kept at 6.x because tsup's DTS build does not support TypeScript 7 yet.

## 1.4.3

### Patch Changes

- 2dfd741: Fix object url parse error when hash is not provided and add support for expiration.

## 1.4.2

### Patch Changes

- 2270574: Fix object url userId parsing error

## 1.4.1

### Patch Changes

- c8102cb: docs: update README to reflect changes in deleting a single object
- 8e1626b: Fix invalid object url error when expire flag is presented

## 1.4.0

### Minor Changes

- cd7a4eb: update delete method to handle a single object and improve documentation

### Patch Changes

- cd7a4eb: fix release :D

## 1.2.0

### Minor Changes

- c126ce5: Add `options` parameter for `objects.list`
- 53f910f: New `SquareCloudBlob#stats` method for checking account stats

### Patch Changes

- 4311dc4: No longer accept rest arrays at `objects.delete`

## 1.1.0

### Minor Changes

- 93ebe06: New `BlobObject` structure

### Patch Changes

- a86d7dc: Update API schemas

## 1.0.1

### Patch Changes

- 044bac6: New `MimeTypeUtil` class for handling supported mime types

## 1.0.0

### Major Changes

- a88b29b: Rename `objects.put` and related to `objects.create`
- a88b29b: Update to new Blob API routes

### Minor Changes

- a73de9f: New `mimeType` prop for `objects.put` method, required if file is a Buffer
- 3810094: `objects.put` now returns useful info about the uploaded object

### Patch Changes

- 1407c2f: Export some typings and mimeType enum
- 3f5c7b8: Fix `objects.list` method

## 0.1.0

### Minor Changes

- d2df79e: Add `BlobObjectsManager#put` method for creating blobs
- e41d578: Add `BlobObjectsManager#delete` method for deleting blobs
- 4240668: Add `BlobObjectsManager#list` method for listing blobs
- d2df79e: New blob objects manager for creating, deleting and listing blobs
