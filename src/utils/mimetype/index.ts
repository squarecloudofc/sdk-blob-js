import { type MimeType, mimeTypes, mimeTypesWithExtension } from "./mimetypes";

// biome-ignore lint/complexity/noStaticOnlyClass: organization
export class MimeTypeUtil {
	/**
	 * Supported mime types with their extensions
	 */
	static mimeTypesWithExtension = mimeTypesWithExtension;
	/**
	 * All supported mime types
	 */
	static mimeTypes = mimeTypes;

	/**
	 * Returns the corresponding MIME type for a given file extension.
	 *
	 * @param extension - The file extension to search for.
	 * @return The MIME type associated with the extension, or "text/plain" if not found.
	 *
	 * @example
	 * ```js
	 * 	MimeTypeUtil.fromExtension("jpeg")   // "image/jpeg"       | Supported
	 * 	MimeTypeUtil.fromExtension("json")   // "application/json" | Supported
	 * 	MimeTypeUtil.fromExtension("potato") // "text/plain"       | Unsupported, defaults to text/plain
	 * ```
	 */
	static fromExtension(extension: string): MimeType {
		const entries = Object.entries(mimeTypesWithExtension);
		const mimeType = entries.find(([, extensions]) =>
			extensions.includes(extension),
		)?.[0];

		return (mimeType as MimeType) || "text/plain";
	}
}

export * from "./enum";
export { MimeType } from "./mimetypes";
