import type { BlobObjectData } from "../types/object";
import { type MimeType, MimeTypeUtil } from "../utils/mimetype";
import { parseObjectUrl } from "../utils/object-url";

export class BlobObject {
	id: string;
	url: string;
	name: string;
	prefix?: string;
	hash: string;
	userId: string;
	extension: string;
	mimeType: MimeType;
	size: number;
	expiresAt?: Date;
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
