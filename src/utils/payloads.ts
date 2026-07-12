import { SquareCloudValidationError } from "../structures/error";
import type { CreateObjectOptions } from "../types/create";
import { type MimeType, MimeTypeUtil } from "./mimetype";

const namePattern = /^[a-zA-Z0-9_]{3,32}$/;

export function makeCreateObjectPayload({
	file,
	name,
	prefix,
	mimeType,
	securityHash,
	autoDownload,
	expiresIn,
}: CreateObjectOptions) {
	if (!namePattern.test(name)) {
		throw new SquareCloudValidationError(
			"INVALID_OBJECT_NAME",
			"Name must match a-z, A-Z, 0-9 or _ (3 to 32 characters)",
		);
	}

	if (prefix && !namePattern.test(prefix)) {
		throw new SquareCloudValidationError(
			"INVALID_OBJECT_PREFIX",
			"Prefix must match a-z, A-Z, 0-9 or _ (3 to 32 characters)",
		);
	}

	if (
		expiresIn !== undefined &&
		(!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 365)
	) {
		throw new SquareCloudValidationError(
			"INVALID_OBJECT_EXPIRE",
			"Expiration must be an integer between 1 and 365 days",
		);
	}

	const type =
		mimeType ??
		(typeof file === "string"
			? MimeTypeUtil.fromExtension(file.split(".").pop() ?? "")
			: undefined);

	if (type && !MimeTypeUtil.mimeTypes.includes(type as MimeType)) {
		throw new SquareCloudValidationError(
			"INVALID_FILE_TYPE",
			`Unsupported MIME type: ${type}`,
		);
	}

	return {
		file,
		mimeType: type,
		params: {
			name,
			prefix,
			expire: expiresIn,
			security_hash: securityHash,
			auto_download: autoDownload,
		},
	};
}
