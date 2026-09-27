import type { BlobErrorCode } from "./error.ts";

// Field names mirror the API (snake_case) so the SDK passes them through untouched.

/** Absolute or relative file path (Node.js), `Blob`/`File`, or raw bytes. */
export type FileInput = string | Blob | Uint8Array | ArrayBuffer;

/** Duration as `"30"` (days), `"30d"` or `"168h"`. */
export type Duration = string;

/** `immutable`, `max-age=60..31536000` or `no-cache` (Enterprise). */
export type CacheControl = string;

export type Disposition = "inline" | "attachment";

export type PutOptions = {
	/**
	 * Object name without extension: `^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$`, no `..`,
	 * not ending in `-ex<digits>`. Required unless the upload token fixes it.
	 */
	name?: string;
	/** Up to 8 segments of `^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$`, 256 chars. */
	prefix?: string;
	/** Default `false`. Private objects always carry a security hash. */
	private?: boolean;
	/** Appends `_<hash>` to the name. */
	security_hash?: boolean;
	/** 7d to 1825d; Enterprise goes down to 1h. The expiration becomes part of the id. */
	expire?: Duration;
	/** `false` fails with `OBJECT_ALREADY_EXISTS` when the name is taken. */
	overwrite?: boolean;
	disposition?: Disposition;
	/** Forces a download (`application/octet-stream`). */
	auto_download?: boolean;
	cache_control?: CacheControl;
	/** Pro and Enterprise. Keys `^[a-z0-9-]{1,64}$` (never `sq-*`), max 5 keys / 512 B. */
	metadata?: Record<string, string>;
	/** 64 lowercase hex. A mismatch fails with `CHECKSUM_MISMATCH` and nothing is stored. */
	checksum_sha256?: string;
	/**
	 * File name whose extension becomes the object's extension. Defaults to the
	 * `File` name or the path's basename.
	 */
	filename?: string;
	/** Only picks the extension when `filename` has none; the server derives the Content-Type. */
	mime_type?: string;
};

export type PutResult = {
	id: string;
	private: boolean;
	/** `null` for private objects: use `downloadUrl()`. */
	url: string | null;
	expires_at?: string;
	size: number;
	/** Simple uploads only (up to ~90 MB). */
	name?: string;
	prefix?: string;
	sha256?: string;
	replaced?: boolean;
	/** Chunked uploads only. */
	parts?: number;
};

export type ListOptions = {
	prefix?: string;
	/** With `"/"`, the page also returns `folders`. */
	delimiter?: "/";
	private?: boolean;
	/** 1 to 1000 (default 1000). */
	limit?: number;
	cursor?: string;
};

export type ListedObject = {
	id: string;
	size: number;
	created_at: string;
	expires_at?: string;
	private: boolean;
	url: string | null;
	etag: string;
};

export type ListPage = {
	objects: ListedObject[];
	/** Only with `delimiter`. */
	folders?: string[];
	/** Absent on the last page. */
	continuationToken?: string;
};

export type ObjectInfo = {
	id: string;
	size: number;
	content_type: string;
	etag: string;
	/** LastModified: a copy (visibility, expiration, headers change) resets it. */
	created_at: string;
	expires_at: string | null;
	private: boolean;
	url: string | null;
	cache_control: string | null;
	content_disposition: string | null;
	original_name: string | null;
	metadata: Record<string, string>;
	legacy: boolean;
};

export type DownloadUrlOptions = {
	/** Link lifetime in seconds, 60 to 86400 (default 3600). */
	expires?: number;
	disposition?: Disposition;
	filename?: string;
};

export type DownloadUrl = {
	url: string;
	/** `null` for the permanent CDN URL of a public object. */
	expires_at: string | null;
	private: boolean;
	size: number;
	content_type: string;
};

export type ObjectChanges = {
	private?: boolean;
	/** `null` removes the expiration. */
	expire?: Duration | null;
	cache_control?: CacheControl | null;
	disposition?: Disposition | null;
	/** `{ key: null }` removes a key; `null` removes all. */
	metadata?: Record<string, string | null> | null;
};

export type UpdateResult =
	| {
			object: string;
			ok: true;
			changed: boolean;
			/** The id after the change: visibility and expiration changes move the object. */
			id: string;
			private: boolean;
			url: string | null;
			expires_at: string | null;
			size: number;
	  }
	| { object: string; ok: false; code: BlobErrorCode };

export type DeleteManyResult = {
	deleted: string[];
	not_found: string[];
	failed: { id: string; code: BlobErrorCode }[];
};

export type CopyDestination = {
	/** Name WITHOUT extension: the destination keeps the source's extension. */
	name: string;
	prefix?: string;
	private?: boolean;
	security_hash?: boolean;
	/** Omitted keeps the source's expiration instant; `null` removes it. */
	expire?: Duration | null;
};

export type CopyResult = {
	id: string;
	private: boolean;
	url: string | null;
	expires_at?: string;
	size: number;
	source: string;
	moved: boolean;
	replaced: boolean;
};

/** All sizes in bytes. Cached for 60 s. */
export type Stats = {
	usage: { objects: number; storage: number };
	plan: { included: number };
	/** An estimate only: the excess is never charged. */
	billing: {
		extraStorage: number;
		storagePrice: number;
		objectsPrice: number;
		totalEstimate: number;
	};
	month: { days: number; average_storage: number };
};

export type Rule = {
	/** e.g. `"a/b/"`. */
	prefix: string;
	private?: boolean;
	expire?: Duration;
	/** 512 B to 10 GiB. */
	max_size?: number;
	/** 1 to 50 of `^[a-z0-9]{1,16}(\.[a-z0-9]{1,16})?$`. */
	extensions?: string[];
	cache_control?: CacheControl;
	/** 7 to 3650 (Enterprise from 1). Only deletes 24 h after the rule is saved. */
	delete_after_days?: number;
};

export type SavedRule = Rule & { created_at: string; active_from: string };

export type UploadTokenOptions = {
	/** Without a fixed name, `security_hash` is mandatory. */
	name?: string;
	prefix?: string;
	private?: boolean;
	security_hash?: boolean;
	expire?: Duration;
	max_size?: number;
	/** 1 to 20 extensions. */
	allowed_extensions?: string[];
	metadata?: Record<string, string>;
	/** Token lifetime in seconds, 60 to 3600 (default 900). */
	expires_in?: number;
	/** 1 to 100 (default 1). */
	max_uses?: number;
};

export type UploadToken = {
	/** `squp_...`: hand it to the browser, never the API key. */
	token: string;
	expires_at: string;
	max_uses: number;
};

export type ShareOptions = {
	/** Seconds, 60 to 2592000 (default 86400). */
	expires_in?: number;
	/** 1 to 10000. */
	max_downloads?: number;
	/** 8 to 128 chars. Pro and Enterprise. */
	password?: string;
};

export type Share = {
	id: string;
	url: string;
	expires_at: string;
	max_downloads: number | null;
	password: boolean;
	object: string;
	/**
	 * `true`: the link redirects to the permanent public URL, so the password,
	 * download cap and expiration do NOT protect the file.
	 */
	object_is_public: boolean;
};

export type ListedShare = {
	id: string;
	url: string;
	object: string;
	expires_at: string;
	remaining_downloads: number | null;
	password: boolean;
	created_at: string;
};

export type S3Credentials = {
	access_key_id: string;
	secret_access_key: string;
	endpoint: string;
	region: string;
	buckets: string[];
	access: { read: boolean | string[]; write: boolean | string[] };
	expires_at: string | null;
};
