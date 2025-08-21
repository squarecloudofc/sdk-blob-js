import type { CreateObjectOptions } from "../types/create";
import { MimeTypeUtil } from "./mimetype";

export function makeCreateObjectPayload({
	file,
	securityHash,
	autoDownload,
	expiresIn,
	...rest
}: CreateObjectOptions) {
	return {
		file,
		mimeType:
			typeof file === "string"
				? MimeTypeUtil.fromExtension(file.split(".")[1])
				: undefined,
		params: {
			...rest,
			expire: expiresIn,
			security_hash: securityHash,
			auto_download: autoDownload,
		},
	};
}
