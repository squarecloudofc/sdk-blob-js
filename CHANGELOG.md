# @squarecloud/blob

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
