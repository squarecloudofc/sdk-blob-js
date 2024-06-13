import type { BlobObjectData } from "../types/object";
import { type MimeType, MimeTypeUtil } from "../utils/mimetype";
import { parseObjectUrl } from "../utils/object-url";

export class BlobObject {
	/** The id of the object */
	id: string;
	/** The url to view or download the object */
	url: string;
	/** The name of the object */
	name: string;
	/** The prefix of the object (Optional) */
	prefix?: string;
	/** The hash of the object */
	hash: string;
	/** The id of the user who created the object */
	userId: string;
	/** The file extension of the object */
	extension: string;
	/** The MIME type of the object */
	mimeType: MimeType;
	/** The size of the object in bytes */
	size: number;
	/** The expiration date of the object (Only available using `objects.list`) */
	expiresAt?: Date;
	/** The creation date of the object (Only available using `objects.list`) */
	createdAt?: Date;

	constructor(data: BlobObjectData) {
		const { id, name, prefix, hash, userId, extension } = parseObjectUrl(
			data.idOrUrl,
		);

		this.id = id;
		this.url = `https://public-blob.squarecloud.dev/${id}`;
		this.name = name;
		this.prefix = prefix;
		this.hash = hash;
		this.userId = userId;
		this.extension = extension;
		this.mimeType = MimeTypeUtil.fromExtension(extension);
		this.size = data.size;
		this.expiresAt = data.expiresAt;
		this.createdAt = data.createdAt;
	}
}
