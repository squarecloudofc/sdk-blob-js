# @squarecloud/blob

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
