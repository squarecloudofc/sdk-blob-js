import type { BlobErrorCode } from "./error.ts";

// Field names mirror the API (snake_case), so the SDK passes them through untouched.

/**
 * A file to upload. Pass a path to a file in Node.js, a `Blob` or `File`, or bytes
 * as a `Uint8Array`, `Buffer` or `ArrayBuffer`.
 */
export type FileInput = string | Blob | Uint8Array | ArrayBuffer;

/**
 * A duration in days or hours. `"30"` and `"30d"` both mean 30 days, and `"6h"`
 * means 6 hours.
 */
export type Duration = string;

/**
 * How long browsers and the global edge CDN may cache an object. Pass
 * `"immutable"`, `"max-age=<seconds>"` with 60 to 31536000 seconds, or
 * `"no-cache"`, which needs an Enterprise plan.
 */
export type CacheControl = string;

/** Whether browsers show a file (`"inline"`) or download it (`"attachment"`). */
export type Disposition = "inline" | "attachment";

/** Options for {@link SquareCloudBlob.put}. */
export type PutOptions = {
	/**
	 * The object name, without an extension. It must match
	 * `^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$`, contain no `..`, and not end in `-ex`
	 * followed by digits. It is required unless the upload token fixes it.
	 */
	name?: string;
	/**
	 * The folder to store the object in, such as `"avatars"` or `"users/42"`. It
	 * has up to 8 segments separated by `/`, each matching
	 * `^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$`, and at most 256 characters in total.
	 */
	prefix?: string;
	/**
	 * Stores the object as private, without a public URL. When omitted, the rule
	 * for the prefix decides, and without a rule the object is public. A private
	 * object always gets a security hash, so `security_hash: false` with
	 * `private: true` fails with 400 `INVALID_OBJECT_SECURITY_HASH`.
	 */
	private?: boolean;
	/**
	 * Appends a random hash (`_<hash>`) to the name. The URL then cannot be
	 * guessed, and the upload never replaces an existing object.
	 */
	security_hash?: boolean;
	/**
	 * How long the object lives, from 7 days to 1825 days (5 years). Enterprise
	 * plans can go down to 1 hour. When omitted, the rule for the prefix decides.
	 *
	 * @remarks
	 * The expiration becomes part of the object id.
	 */
	expire?: Duration;
	/**
	 * Whether the upload replaces an existing object with the same name. The
	 * default is `true`. With `false`, a taken name fails with 409
	 * `OBJECT_ALREADY_EXISTS`.
	 *
	 * @remarks
	 * For a file above 90 MiB, the SDK checks the name before it sends any part,
	 * and the service checks again when the upload completes. With an upload
	 * token, this option has no effect, because the token decides whether its
	 * upload can replace an object.
	 */
	overwrite?: boolean;
	/** Whether browsers show the file or download it. See {@link Disposition}. */
	disposition?: Disposition;
	/**
	 * Serves the file as `application/octet-stream`, so browsers download it
	 * instead of opening it.
	 */
	auto_download?: boolean;
	/**
	 * How long browsers and the global edge CDN may cache the object. See
	 * {@link CacheControl}. When omitted, the rule for the prefix decides, and a
	 * name with a security hash is cached as immutable.
	 */
	cache_control?: CacheControl;
	/**
	 * Custom key-value pairs stored with the object, on Pro and Enterprise plans.
	 * Use up to 5 keys that match `^[a-z0-9-]{1,64}$` and do not start with
	 * `sq-`, with at most 512 bytes of keys and values in total.
	 */
	metadata?: Record<string, string>;
	/**
	 * The SHA-256 of the file, as 64 lowercase hex characters. If the file does
	 * not match, the upload fails with 400 `CHECKSUM_MISMATCH` and nothing is
	 * stored.
	 *
	 * @remarks
	 * Only files up to 90 MiB are checked. A chunked upload ignores this option.
	 */
	checksum_sha256?: string;
	/**
	 * The file name, such as `"photo.png"`. Its extension becomes the object's
	 * extension, and the name is kept as the object's `original_name`. It
	 * defaults to the name of the `File` or the last part of the path. Bytes and
	 * plain `Blob`s have no name, so pass `filename` for them. Without one, the
	 * extension comes from `mime_type` or the `Blob` type, and it is `.bin` when
	 * neither gives one.
	 */
	filename?: string;
	/**
	 * A MIME type that picks the extension when `filename` has none. The service
	 * always derives the stored Content-Type from the extension.
	 */
	mime_type?: string;
};

/** The object that {@link SquareCloudBlob.put} stored. */
export type PutResult = {
	/** The object id. Store it as returned, and never build or parse it. */
	id: string;
	/** Whether the object is private. */
	private: boolean;
	/**
	 * The public URL, or `null` for a private object. Use
	 * {@link SquareCloudBlob.downloadUrl} for a link to a private object.
	 */
	url: string | null;
	/** When the object expires, as an ISO 8601 date. It is absent when the object never expires. */
	expires_at?: string;
	/** The size in bytes. */
	size: number;
	/** The name of the object. Only uploads up to 90 MiB return it. */
	name?: string;
	/** The prefix of the object. Only uploads up to 90 MiB return it. */
	prefix?: string;
	/** The SHA-256 of the stored file. Only uploads up to 90 MiB return it. */
	sha256?: string;
	/** `true` when the upload replaced an existing object. Only uploads up to 90 MiB return it. */
	replaced?: boolean;
	/** How many parts the upload was sent in. Only uploads above 90 MiB return it. */
	parts?: number;
};

/** Filters for {@link SquareCloudBlob.list} and {@link SquareCloudBlob.listPage}. */
export type ListOptions = {
	/** Lists only the objects under this prefix, such as `"avatars/"`. */
	prefix?: string;
	/**
	 * Groups objects by folder. With `"/"`, the page lists the folders right
	 * under `prefix` in `folders`, and only the objects at that level in
	 * `objects`.
	 */
	delimiter?: "/";
	/**
	 * Lists only private objects with `true`, or only public objects with
	 * `false`. When omitted, both are listed.
	 */
	private?: boolean;
	/** The most objects and folders a page holds, from 1 to 1000. The default is 1000. */
	limit?: number;
	/** The `continuationToken` of the previous page, to fetch the next one. */
	cursor?: string;
};

/** An object in a listing. */
export type ListedObject = {
	/** The object id. */
	id: string;
	/** The size in bytes. */
	size: number;
	/**
	 * When the object was last written, as an ISO 8601 date. Changing its
	 * visibility, expiration or headers resets it.
	 */
	created_at: string;
	/** When the object expires, as an ISO 8601 date. It is absent when the object never expires. */
	expires_at?: string;
	/** Whether the object is private. */
	private: boolean;
	/** The public URL, or `null` for a private object. */
	url: string | null;
	/** The entity tag of the stored content. It changes when the content changes. */
	etag: string;
};

/** One page of a listing, from {@link SquareCloudBlob.listPage}. */
export type ListPage = {
	/** The objects on this page. */
	objects: ListedObject[];
	/** The folders on this page. They are present only when `delimiter` is set. */
	folders?: string[];
	/** The cursor of the next page, to pass as `cursor`. It is absent on the last page. */
	continuationToken?: string;
};

/** The details of one object, from {@link SquareCloudBlob.info}. */
export type ObjectInfo = {
	/** The object id. */
	id: string;
	/** The size in bytes. */
	size: number;
	/** The Content-Type the object is served with. */
	content_type: string;
	/** The entity tag of the stored content. It changes when the content changes. */
	etag: string;
	/**
	 * When the object was last written, as an ISO 8601 date. Changing its
	 * visibility, expiration or headers resets it.
	 */
	created_at: string;
	/** When the object expires, as an ISO 8601 date, or `null` when it never expires. */
	expires_at: string | null;
	/** Whether the object is private. */
	private: boolean;
	/** The public URL, or `null` for a private object. */
	url: string | null;
	/** The Cache-Control header the object is served with, or `null` when none is set. */
	cache_control: string | null;
	/** The Content-Disposition header the object is served with, or `null` when none is set. */
	content_disposition: string | null;
	/** The file name the object was uploaded with, or `null` when it had none. */
	original_name: string | null;
	/** Your custom metadata. It is an empty object when there is none. */
	metadata: Record<string, string>;
	/** @deprecated The service no longer sends it, so it is always `undefined`. */
	legacy?: boolean;
};

/** Options for {@link SquareCloudBlob.downloadUrl}. */
export type DownloadUrlOptions = {
	/**
	 * How long a temporary link lives, in seconds, from 60 to 86400 (24 hours).
	 * The default is 3600 (1 hour). The permanent URL of a public object ignores
	 * it.
	 */
	expires?: number;
	/**
	 * Whether browsers show the file or download it. Passing it always returns a
	 * temporary link.
	 */
	disposition?: Disposition;
	/**
	 * The file name browsers save the download as. Passing it always returns a
	 * temporary link, which downloads the file unless `disposition` is
	 * `"inline"`.
	 */
	filename?: string;
};

/** A download link, from {@link SquareCloudBlob.downloadUrl}. */
export type DownloadUrl = {
	/** The link. */
	url: string;
	/**
	 * When a temporary link stops working, as an ISO 8601 date, or `null` for
	 * the permanent URL of a public object.
	 */
	expires_at: string | null;
	/** Whether the object is private. */
	private: boolean;
	/** The size of the object in bytes. */
	size: number;
	/** The Content-Type the object is served with. */
	content_type: string;
};

/** Changes for {@link SquareCloudBlob.update}. Omit a field to leave it as it is. */
export type ObjectChanges = {
	/**
	 * Makes the object private with `true`, or public with `false`. Either change
	 * gives the object a new id.
	 */
	private?: boolean;
	/**
	 * A new expiration, counted from now, or `null` to remove it. Either change
	 * gives the object a new id.
	 */
	expire?: Duration | null;
	/** A new Cache-Control setting, or `null` to remove it. */
	cache_control?: CacheControl | null;
	/** A new disposition, or `null` to remove it. */
	disposition?: Disposition | null;
	/**
	 * Metadata keys to set. A key set to `null` is removed, and `null` in place
	 * of the object removes every key.
	 */
	metadata?: Record<string, string | null> | null;
};

/**
 * The result of {@link SquareCloudBlob.update} for one object. Check `ok` before
 * reading the other fields.
 */
export type UpdateResult =
	| {
			/** The id you passed. */
			object: string;
			ok: true;
			/** `true` when the object has a new id. Replace your stored id with `id`. */
			changed: boolean;
			/**
			 * The id after the change. Visibility and expiration changes give the
			 * object a new id.
			 */
			id: string;
			/** Whether the object is private. */
			private: boolean;
			/** The public URL, or `null` for a private object. */
			url: string | null;
			/** When the object expires, as an ISO 8601 date, or `null` when it never expires. */
			expires_at: string | null;
			/** The size in bytes. */
			size: number;
	  }
	| {
			/** The id you passed. */
			object: string;
			ok: false;
			/** Why this object was not changed, such as `OBJECT_NOT_FOUND` or `PERMISSION_DENIED`. */
			code: BlobErrorCode;
	  };

/** The result of {@link SquareCloudBlob.delete} with an array of ids. */
export type DeleteManyResult = {
	/** The ids that were deleted. */
	deleted: string[];
	/** The ids that did not exist. */
	not_found: string[];
	/**
	 * The ids that could not be deleted, each with its code. `PREFIX_NOT_ALLOWED`
	 * means the API key cannot reach that prefix. Any other code means storage
	 * failed and the object may still exist, so try those ids again.
	 */
	failed: { id: string; code: BlobErrorCode }[];
};

/** Where {@link SquareCloudBlob.copy} and {@link SquareCloudBlob.move} put the object. */
export type CopyDestination = {
	/** The new name, without an extension. The object keeps the extension of the source. */
	name: string;
	/**
	 * The new folder. When omitted, the object lands at the root, not in the
	 * folder of the source.
	 */
	prefix?: string;
	/** Whether the object is private. When omitted, it keeps the visibility of the source. */
	private?: boolean;
	/**
	 * Appends a random hash to the new name. A private object always gets one, and
	 * a public object gets one only when this is `true`.
	 */
	security_hash?: boolean;
	/**
	 * A new expiration, counted from now, or `null` for none. When omitted, the
	 * object expires at the same moment as the source.
	 */
	expire?: Duration | null;
};

/** The object that {@link SquareCloudBlob.copy} or {@link SquareCloudBlob.move} wrote. */
export type CopyResult = {
	/** The id of the new object. */
	id: string;
	/** Whether the new object is private. */
	private: boolean;
	/** The public URL, or `null` for a private object. */
	url: string | null;
	/** When the new object expires, as an ISO 8601 date. It is absent when it never expires. */
	expires_at?: string;
	/** The size in bytes. */
	size: number;
	/** The id of the source. */
	source: string;
	/** `true` for a move, after which the source no longer exists. */
	moved: boolean;
	/** `true` when the new object replaced an existing one. */
	replaced: boolean;
};

/**
 * The storage usage of the account, from {@link SquareCloudBlob.stats}. Sizes are
 * in bytes.
 */
export type Stats = {
	/** How many objects you store, and how many bytes they take. */
	usage: { objects: number; storage: number };
	/** How many bytes of storage your plan includes. */
	plan: { included: number };
	/** An estimate of what the storage above your plan would cost. It is not charged. */
	billing: {
		/** The bytes stored above what your plan includes. */
		extraStorage: number;
		/** The estimated price of `extraStorage`. */
		storagePrice: number;
		/** The estimated price for the number of objects, which is 0 because objects are not priced. */
		objectsPrice: number;
		/** The sum of the estimated prices. */
		totalEstimate: number;
	};
	/**
	 * This month so far, in UTC. `days` counts the days that have started, today
	 * included, and `average_storage` is the average number of bytes stored per
	 * day over them.
	 */
	month: { days: number; average_storage: number };
};

/** A rule for one prefix, for {@link SquareCloudBlob.rules}. */
export type Rule = {
	/**
	 * The prefix the rule applies to, such as `"avatars/"`. It also covers the
	 * prefixes below it, unless a rule with a longer prefix matches.
	 */
	prefix: string;
	/** The default visibility of new objects under the prefix. */
	private?: boolean;
	/** The default expiration of new objects under the prefix. */
	expire?: Duration;
	/** The largest file allowed under the prefix, in bytes, from 512 bytes to 10 GiB. */
	max_size?: number;
	/**
	 * The only file extensions allowed under the prefix. List 1 to 50, each
	 * matching `^[a-z0-9]{1,16}(\.[a-z0-9]{1,16})?$`.
	 */
	extensions?: string[];
	/** The default Cache-Control of new objects under the prefix. */
	cache_control?: CacheControl;
	/**
	 * Deletes objects under the prefix this many days after they were written,
	 * from 7 to 3650 days. Enterprise plans can go down to 1 day.
	 *
	 * @remarks
	 * Deletion starts 24 hours after the rule is saved.
	 */
	delete_after_days?: number;
};

/** A rule as {@link SquareCloudBlob.rules} returns it. */
export type SavedRule = Rule & {
	/** When the rule was saved, as an ISO 8601 date. */
	created_at: string;
	/**
	 * When the rule starts deleting objects, as an ISO 8601 date. It is present
	 * only on a rule with `delete_after_days`.
	 */
	active_from?: string;
};

/**
 * Options for {@link SquareCloudBlob.uploadTokens}. Every option the token sets is
 * fixed, and the browser cannot change it.
 */
export type UploadTokenOptions = {
	/**
	 * Fixes the object name. Without it, the browser picks the name, and a
	 * security hash is always added, so the token can never replace an existing
	 * object.
	 */
	name?: string;
	/**
	 * Fixes the prefix. An upload with another prefix fails with 403
	 * `PREFIX_NOT_ALLOWED`. A token with a fixed `name` and no prefix uploads to
	 * the root.
	 */
	prefix?: string;
	/** Fixes the visibility. */
	private?: boolean;
	/**
	 * Whether a fixed `name` gets a security hash. The default is `true`. Only a
	 * token with a fixed `name` and `security_hash: false` can replace an existing
	 * object.
	 */
	security_hash?: boolean;
	/** Fixes the expiration of the uploaded object. */
	expire?: Duration;
	/** The largest file the token accepts, in bytes, from 512 bytes to 10 GiB. */
	max_size?: number;
	/** The only file extensions the token accepts, 1 to 20 of them, such as `["png", "jpg"]`. */
	allowed_extensions?: string[];
	/**
	 * Metadata added to every object uploaded with the token, on Pro and
	 * Enterprise plans. The limits of {@link PutOptions.metadata} apply to the
	 * token's metadata and the upload's together.
	 */
	metadata?: Record<string, string>;
	/** How long the token lives, in seconds, from 60 to 3600. The default is 900 (15 minutes). */
	expires_in?: number;
	/** How many uploads the token allows, from 1 to 100. The default is 1. */
	max_uses?: number;
};

/** An upload token, from {@link SquareCloudBlob.uploadTokens}. */
export type UploadToken = {
	/** The token (`squp_...`). Hand it to the browser, and keep the API key on your server. */
	token: string;
	/** When the token stops working, as an ISO 8601 date. */
	expires_at: string;
	/** How many uploads the token allows. */
	max_uses: number;
};

/** Options for {@link SquareCloudBlob.shares}. */
export type ShareOptions = {
	/**
	 * How long the link lives, in seconds, from 60 to 2592000 (30 days). The
	 * default is 86400 (24 hours).
	 */
	expires_in?: number;
	/** How many downloads the link allows, from 1 to 10000. When omitted, there is no cap. */
	max_downloads?: number;
	/** A password of 8 to 128 characters that visitors must enter, on Pro and Enterprise plans. */
	password?: string;
};

/** A share link, from {@link SquareCloudBlob.shares}. */
export type Share = {
	/** The share id, which revokes the link. */
	id: string;
	/** The link to hand out. */
	url: string;
	/** When the link stops working, as an ISO 8601 date. */
	expires_at: string;
	/** The download cap, or `null` when there is none. */
	max_downloads: number | null;
	/** Whether the link asks for a password. */
	password: boolean;
	/** The id of the shared object. */
	object: string;
	/**
	 * `true` when the object is public. The link then redirects to the object's
	 * public URL, so the password, download cap and expiration do not protect the
	 * file. Make the object private before you share it.
	 */
	object_is_public: boolean;
};

/** An active share link, from {@link SquareCloudBlob.shares}. */
export type ListedShare = {
	/** The share id, which revokes the link. */
	id: string;
	/** The link. */
	url: string;
	/** The id of the shared object. */
	object: string;
	/** When the link stops working, as an ISO 8601 date. */
	expires_at: string;
	/** How many downloads are left, or `null` when there is no cap. */
	remaining_downloads: number | null;
	/** Whether the link asks for a password. */
	password: boolean;
	/** When the link was created, as an ISO 8601 date. */
	created_at: string;
};

/** The S3 key pair of an API key, from {@link SquareCloudBlob.s3Credentials}. */
export type S3Credentials = {
	/** The access key id. */
	access_key_id: string;
	/** The secret access key. Keep it as secret as the API key. */
	secret_access_key: string;
	/** The endpoint to point your S3 client at. */
	endpoint: string;
	/** The region to configure, which is `auto`. */
	region: string;
	/** The buckets, `public` and `private`. */
	buckets: string[];
	/**
	 * What the key pair can read and write. `true` means the whole account,
	 * `false` means nothing, and a list of prefixes means only those prefixes.
	 */
	access: { read: boolean | string[]; write: boolean | string[] };
	/**
	 * When the API key expires, and the key pair with it, as an ISO 8601 date.
	 * It is `null` when the API key never expires.
	 */
	expires_at: string | null;
};
